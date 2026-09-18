export type AuthProfile = {
  id: string;
  role: "creator" | "admin";
  display_name: string;
  website_url: string | null;
};

export type IdentityProvider = "github" | "google" | "email";

export type ProviderIdentity = {
  provider: IdentityProvider;
  subject: string;
  displayName: string;
  websiteUrl: string | null;
  email: string | null;
  emailVerified: boolean;
};

export type LinkIdentityResult =
  { ok: true; profile: AuthProfile } | { ok: false; reason: "identity_in_use" };

const sessionLifetimeSeconds = 60 * 60 * 24 * 30;

export async function resolveProviderProfile(
  db: D1Database,
  identity: ProviderIdentity,
  now = new Date().toISOString(),
): Promise<AuthProfile> {
  const existing = await db
    .prepare(
      `
        SELECT p.id, p.role, p.display_name, p.website_url
        FROM auth_identities i
        JOIN profiles p ON p.id = i.profile_id
        WHERE i.provider = ? AND i.provider_subject = ?
        LIMIT 1
      `,
    )
    .bind(identity.provider, identity.subject)
    .first<AuthProfile>();

  if (existing) {
    await db.batch([
      db
        .prepare(
          `
            UPDATE profiles
            SET display_name = ?, website_url = COALESCE(?, website_url)
            WHERE id = ?
          `,
        )
        .bind(identity.displayName, identity.websiteUrl, existing.id),
      db
        .prepare(
          `
            UPDATE auth_identities
            SET email_normalized = ?, email_verified = ?, updated_at = ?
            WHERE provider = ? AND provider_subject = ?
          `,
        )
        .bind(
          normalizeEmail(identity.email),
          identity.emailVerified ? 1 : 0,
          now,
          identity.provider,
          identity.subject,
        ),
    ]);
    return {
      ...existing,
      display_name: identity.displayName,
      website_url: identity.websiteUrl ?? existing.website_url,
    };
  }

  const profileId = `${identity.provider}:${identity.subject}`;
  await db.batch([
    db
      .prepare(
        `
          INSERT INTO profiles (id, role, display_name, website_url, created_at)
          VALUES (?, 'creator', ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            display_name = excluded.display_name,
            website_url = COALESCE(excluded.website_url, profiles.website_url)
        `,
      )
      .bind(profileId, identity.displayName, identity.websiteUrl, now),
    db
      .prepare(
        `
          INSERT INTO auth_identities (
            id, profile_id, provider, provider_subject, email_normalized,
            email_verified, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(provider, provider_subject) DO UPDATE SET
            email_normalized = excluded.email_normalized,
            email_verified = excluded.email_verified,
            updated_at = excluded.updated_at
        `,
      )
      .bind(
        `${identity.provider}:${identity.subject}`,
        profileId,
        identity.provider,
        identity.subject,
        normalizeEmail(identity.email),
        identity.emailVerified ? 1 : 0,
        now,
        now,
      ),
  ]);

  const profile = await db
    .prepare("SELECT id, role, display_name, website_url FROM profiles WHERE id = ? LIMIT 1")
    .bind(profileId)
    .first<AuthProfile>();
  if (!profile) throw new Error("Authentication profile could not be created.");
  return profile;
}

export async function linkProviderIdentity(
  db: D1Database,
  profileId: string,
  identity: ProviderIdentity,
  now = new Date().toISOString(),
): Promise<LinkIdentityResult> {
  await db
    .prepare(
      `
        INSERT INTO auth_identities (
          id, profile_id, provider, provider_subject, email_normalized,
          email_verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, provider_subject) DO NOTHING
      `,
    )
    .bind(
      `${identity.provider}:${identity.subject}`,
      profileId,
      identity.provider,
      identity.subject,
      normalizeEmail(identity.email),
      identity.emailVerified ? 1 : 0,
      now,
      now,
    )
    .run();

  const owner = await db
    .prepare(
      `
        SELECT profile_id
        FROM auth_identities
        WHERE provider = ? AND provider_subject = ?
        LIMIT 1
      `,
    )
    .bind(identity.provider, identity.subject)
    .first<{ profile_id: string }>();
  if (!owner || owner.profile_id !== profileId) {
    return { ok: false, reason: "identity_in_use" };
  }

  const profile = await db
    .prepare("SELECT id, role, display_name, website_url FROM profiles WHERE id = ? LIMIT 1")
    .bind(profileId)
    .first<AuthProfile>();
  if (!profile) throw new Error("Authentication profile could not be linked.");
  return { ok: true, profile };
}

export async function createAuthSession(
  db: D1Database,
  profileId: string,
  now = new Date(),
): Promise<string> {
  const sessionToken = crypto.randomUUID() + crypto.randomUUID();
  const tokenHash = await hashAuthToken(sessionToken);
  const expiresAt = new Date(now.getTime() + sessionLifetimeSeconds * 1_000).toISOString();
  await db
    .prepare(
      `
        INSERT INTO auth_sessions (id, profile_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .bind(crypto.randomUUID(), profileId, tokenHash, expiresAt, now.toISOString())
    .run();
  return sessionToken;
}

export async function hashAuthToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function authSessionLifetimeSeconds(): number {
  return sessionLifetimeSeconds;
}

function normalizeEmail(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.normalize("NFKC").trim().toLocaleLowerCase("en");
  return normalized.includes("@") ? normalized : null;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
