import { env } from "cloudflare:workers";

export const sessionCookieName = "publisher_asset_session";
export const oauthStateCookieName = "publisher_asset_oauth_state";
const sessionLifetimeSeconds = 60 * 60 * 24 * 30;
const oauthStateLifetimeSeconds = 60 * 10;

export type AuthProfile = {
  id: string;
  role: "creator" | "admin";
  display_name: string;
  website_url: string | null;
};

type AuthBindings = {
  DB: D1Database;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  AUTH_SECRET?: string;
};

type GithubUser = {
  id?: unknown;
  login?: unknown;
  name?: unknown;
  blog?: unknown;
};

type GithubTokenResponse = {
  access_token?: unknown;
};

function bindings(): AuthBindings {
  return env as unknown as AuthBindings;
}

export function authIsConfigured(): boolean {
  const config = bindings();
  return Boolean(
    config.GITHUB_OAUTH_CLIENT_ID && config.GITHUB_OAUTH_CLIENT_SECRET && config.AUTH_SECRET,
  );
}

export function githubAuthorizationUrl(request: Request, state: string): string {
  const clientId = bindings().GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("GitHub OAuth is not configured.");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl(request));
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function completeGithubLogin(
  request: Request,
  code: string,
): Promise<{ profile: AuthProfile; sessionToken: string }> {
  const config = bindings();
  if (!config.GITHUB_OAUTH_CLIENT_ID || !config.GITHUB_OAUTH_CLIENT_SECRET) {
    throw new Error("GitHub OAuth is not configured.");
  }
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "publisher-asset-marketplace",
    },
    body: JSON.stringify({
      client_id: config.GITHUB_OAUTH_CLIENT_ID,
      client_secret: config.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl(request),
    }),
  });
  if (!tokenResponse.ok) throw new Error("GitHub token exchange failed.");
  const tokenPayload = (await tokenResponse.json()) as GithubTokenResponse;
  if (typeof tokenPayload.access_token !== "string" || tokenPayload.access_token.length < 10) {
    throw new Error("GitHub token exchange returned no access token.");
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${tokenPayload.access_token}`,
      "user-agent": "publisher-asset-marketplace",
    },
  });
  if (!userResponse.ok) throw new Error("GitHub profile lookup failed.");
  const user = (await userResponse.json()) as GithubUser;
  const githubId =
    typeof user.id === "number" || typeof user.id === "string" ? String(user.id) : "";
  const login = typeof user.login === "string" ? user.login.trim() : "";
  if (!githubId || !login) throw new Error("GitHub profile is incomplete.");

  const profile: AuthProfile = {
    id: `github:${githubId}`,
    role: "creator",
    display_name:
      typeof user.name === "string" && user.name.trim().length > 0 ? user.name.trim() : login,
    website_url: normalizeWebsite(user.blog),
  };
  const now = new Date().toISOString();
  await config.DB.prepare(
    `
      INSERT INTO profiles (id, role, display_name, website_url, created_at)
      VALUES (?, 'creator', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        website_url = COALESCE(excluded.website_url, profiles.website_url)
    `,
  )
    .bind(profile.id, profile.display_name, profile.website_url, now)
    .run();

  const sessionToken = crypto.randomUUID() + crypto.randomUUID();
  const tokenHash = await hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1_000).toISOString();
  await config.DB.prepare(
    `
      INSERT INTO auth_sessions (id, profile_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
  )
    .bind(crypto.randomUUID(), profile.id, tokenHash, expiresAt, now)
    .run();
  return { profile, sessionToken };
}

export async function getAuthenticatedProfile(
  request: Request,
  db: D1Database,
): Promise<AuthProfile | null> {
  const token = parseCookies(request.headers.get("cookie"))[sessionCookieName];
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `
        SELECT p.id, p.role, p.display_name, p.website_url
        FROM auth_sessions s
        JOIN profiles p ON p.id = s.profile_id
        WHERE s.token_hash = ? AND s.expires_at > ?
        LIMIT 1
      `,
    )
    .bind(tokenHash, now)
    .first<AuthProfile>();
  return row ?? null;
}

export async function deleteAuthSession(request: Request, db: D1Database): Promise<void> {
  const token = parseCookies(request.headers.get("cookie"))[sessionCookieName];
  if (!token) return;
  await db
    .prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
    .bind(await hashToken(token))
    .run();
}

export function stateCookie(state: string): string {
  return serializeCookie(oauthStateCookieName, state, oauthStateLifetimeSeconds);
}

export async function signOAuthState(state: string): Promise<string> {
  const secret = bindings().AUTH_SECRET;
  if (!secret) throw new Error("Auth secret is not configured.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(state));
  return `${state}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyOAuthState(
  state: string,
  signedState: string | null,
): Promise<boolean> {
  if (!signedState) return false;
  return signedState === (await signOAuthState(state));
}

export function clearStateCookie(): string {
  return serializeCookie(oauthStateCookieName, "", 0);
}

export function sessionCookie(token: string): string {
  return serializeCookie(sessionCookieName, token, sessionLifetimeSeconds);
}

export function clearSessionCookie(): string {
  return serializeCookie(sessionCookieName, "", 0);
}

export function callbackUrl(request: Request): string {
  return new URL("/api/auth/github/callback", request.url).toString();
}

export function readState(request: Request): string | null {
  return parseCookies(request.headers.get("cookie"))[oauthStateCookieName] ?? null;
}

export function oauthStateLifetime(): number {
  return oauthStateLifetimeSeconds;
}

async function hashToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function normalizeWebsite(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function serializeCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name, value]) => Boolean(name && value))
      .map(([name, value]) => [name, decodeURIComponent(value as string)]),
  );
}
