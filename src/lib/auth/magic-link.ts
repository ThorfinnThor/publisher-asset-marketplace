import { env } from "cloudflare:workers";

import {
  createMagicLinkToken,
  magicLinkDisplayName,
  magicLinkEmailHourlyLimit,
  magicLinkFragmentUrl,
  magicLinkIdentitySeed,
  magicLinkIpHourlyLimit,
  magicLinkLifetimeMinutes,
  normalizeMagicLinkAppOrigin,
  normalizeMagicLinkEmail,
  validMagicLinkToken,
} from "./magic-link-core";
import {
  createAuthSession,
  hashAuthToken,
  resolveProviderProfile,
  type AuthProfile,
} from "./identity";

const cloudflareEmailEndpoint = "https://api.cloudflare.com/client/v4/accounts";

type MagicLinkBindings = typeof env & {
  EMAIL_SENDING_API_TOKEN?: string;
  EMAIL_ACCOUNT_ID?: string;
  MAGIC_LINK_FROM_EMAIL?: string;
  MAGIC_LINK_APP_ORIGIN?: string;
  AUTH_SECRET?: string;
};

type MagicLinkRateRow = {
  request_count: number;
};

type MagicLinkEmailResponse = {
  success?: unknown;
};

type MagicLinkRow = {
  email_normalized: string;
};

function bindings(): MagicLinkBindings {
  return env as MagicLinkBindings;
}

export function magicLinkAuthIsConfigured(): boolean {
  const config = bindings();
  return Boolean(
    config.EMAIL_SENDING_API_TOKEN &&
    config.EMAIL_ACCOUNT_ID &&
    normalizeMagicLinkEmail(config.MAGIC_LINK_FROM_EMAIL) &&
    normalizeMagicLinkAppOrigin(config.MAGIC_LINK_APP_ORIGIN) &&
    config.AUTH_SECRET,
  );
}

export async function requestMagicLink(
  request: Request,
  emailInput: unknown,
): Promise<"sent" | "ignored"> {
  const config = bindings();
  const email = normalizeMagicLinkEmail(emailInput);
  if (!email) return "ignored";
  if (!magicLinkAuthIsConfigured()) throw new Error("Magic-link sign-in is not configured.");

  const now = new Date();
  const nowIso = now.toISOString();
  const rateWindow = `${nowIso.slice(0, 13)}:00:00.000Z`;
  const rateExpiry = new Date(now.getTime() + 2 * 60 * 60 * 1_000).toISOString();
  const authSecret = config.AUTH_SECRET;
  if (!authSecret) throw new Error("Authentication is not configured.");
  const ipHash = await privateRequestHash(
    authSecret,
    `magic-link-ip:${request.headers.get("cf-connecting-ip") ?? "unavailable"}`,
  );
  const emailHash = await privateRequestHash(authSecret, `magic-link-email:${email}`);
  const [emailCount, ipCount] = await Promise.all([
    incrementRateLimit(config.DB, `email:${emailHash}`, rateWindow, rateExpiry),
    incrementRateLimit(config.DB, `ip:${ipHash}`, rateWindow, rateExpiry),
  ]);
  if (emailCount > magicLinkEmailHourlyLimit || ipCount > magicLinkIpHourlyLimit) {
    return "ignored";
  }

  const token = createMagicLinkToken();
  const tokenHash = await hashAuthToken(token);
  const id = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + magicLinkLifetimeMinutes * 60 * 1_000).toISOString();
  await config.DB.prepare(
    `
      INSERT INTO auth_magic_links (
        id, email_normalized, token_hash, request_ip_hash,
        delivery_status, expires_at, consumed_at, created_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, NULL, ?)
    `,
  )
    .bind(id, email, tokenHash, ipHash, expiresAt, nowIso)
    .run();

  try {
    const appOrigin = normalizeMagicLinkAppOrigin(config.MAGIC_LINK_APP_ORIGIN);
    if (!appOrigin) throw new Error("Magic-link application origin is not configured.");
    await sendMagicLinkEmail(config, email, magicLinkFragmentUrl(appOrigin, token));
    await config.DB.prepare("UPDATE auth_magic_links SET delivery_status = 'sent' WHERE id = ?")
      .bind(id)
      .run();
  } catch (error) {
    await config.DB.prepare(
      `
        UPDATE auth_magic_links
        SET delivery_status = 'failed', consumed_at = ?
        WHERE id = ?
      `,
    )
      .bind(new Date().toISOString(), id)
      .run();
    throw error;
  }

  await config.DB.prepare("DELETE FROM auth_magic_links WHERE expires_at < ?")
    .bind(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000).toISOString())
    .run();
  await config.DB.prepare("DELETE FROM auth_magic_link_rate_limits WHERE expires_at < ?")
    .bind(nowIso)
    .run();
  return "sent";
}

export async function consumeMagicLink(
  tokenInput: unknown,
): Promise<{ profile: AuthProfile; sessionToken: string } | null> {
  if (!validMagicLinkToken(tokenInput)) return null;
  const config = bindings();
  if (!config.AUTH_SECRET) throw new Error("Authentication is not configured.");
  const now = new Date();
  const nowIso = now.toISOString();
  const tokenHash = await hashAuthToken(tokenInput);
  const link = await config.DB.prepare(
    `
      UPDATE auth_magic_links
      SET consumed_at = ?
      WHERE token_hash = ?
        AND delivery_status = 'sent'
        AND consumed_at IS NULL
        AND expires_at > ?
      RETURNING email_normalized
    `,
  )
    .bind(nowIso, tokenHash, nowIso)
    .first<MagicLinkRow>();
  if (!link) return null;

  const subject = await hashAuthToken(magicLinkIdentitySeed(link.email_normalized));
  const profile = await resolveProviderProfile(
    config.DB,
    {
      provider: "email",
      subject,
      displayName: magicLinkDisplayName(link.email_normalized),
      websiteUrl: null,
      email: link.email_normalized,
      emailVerified: true,
    },
    nowIso,
  );
  const sessionToken = await createAuthSession(config.DB, profile.id, now);
  return { profile, sessionToken };
}

async function sendMagicLinkEmail(
  config: MagicLinkBindings,
  recipient: string,
  link: string,
): Promise<void> {
  const accountId = config.EMAIL_ACCOUNT_ID;
  const apiToken = config.EMAIL_SENDING_API_TOKEN;
  const from = normalizeMagicLinkEmail(config.MAGIC_LINK_FROM_EMAIL);
  if (!accountId || !apiToken || !from) throw new Error("Email sending is not configured.");

  const response = await fetch(
    `${cloudflareEmailEndpoint}/${encodeURIComponent(accountId)}/email/sending/send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        to: recipient,
        from: { address: from, name: "Publisher Asset Marketplace" },
        subject: "Your sign-in link",
        text: `Use this one-time link to sign in:\n\n${link}\n\nIt expires in ${magicLinkLifetimeMinutes} minutes. If you did not request this email, you can ignore it.`,
        html: `<p>Use this one-time link to sign in:</p><p><a href="${escapeHtml(link)}">Sign in to Publisher Asset Marketplace</a></p><p>This link expires in ${magicLinkLifetimeMinutes} minutes. If you did not request this email, you can ignore it.</p>`,
      }),
    },
  );
  const payload = (await response.json().catch(() => null)) as MagicLinkEmailResponse | null;
  if (!response.ok || payload?.success !== true) {
    throw new Error("Cloudflare Email Service rejected the sign-in email.");
  }
}

async function privateRequestHash(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function incrementRateLimit(
  db: D1Database,
  scopeKey: string,
  windowStartedAt: string,
  expiresAt: string,
): Promise<number> {
  const row = await db
    .prepare(
      `
        INSERT INTO auth_magic_link_rate_limits (
          scope_key, window_started_at, request_count, expires_at
        ) VALUES (?, ?, 1, ?)
        ON CONFLICT(scope_key, window_started_at) DO UPDATE SET
          request_count = auth_magic_link_rate_limits.request_count + 1,
          expires_at = excluded.expires_at
        RETURNING request_count
      `,
    )
    .bind(scopeKey, windowStartedAt, expiresAt)
    .first<MagicLinkRateRow>();
  if (!row) throw new Error("Magic-link rate limit could not be updated.");
  return Number(row.request_count);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
