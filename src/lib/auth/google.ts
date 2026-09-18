import { env } from "cloudflare:workers";

import { validatedGoogleClaims, type GoogleIdClaims } from "./google-claims";
import { createAuthSession, resolveProviderProfile, type AuthProfile } from "./identity";
import { verifyOAuthState } from "./github";

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";

type GoogleAuthBindings = {
  DB: D1Database;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  AUTH_SECRET?: string;
};

type GoogleTokenResponse = {
  id_token?: unknown;
};

type GoogleJwtHeader = {
  alg?: unknown;
  kid?: unknown;
};

type GoogleJwks = {
  keys?: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }>;
};

function bindings(): GoogleAuthBindings {
  return env as unknown as GoogleAuthBindings;
}

export function googleAuthIsConfigured(): boolean {
  const config = bindings();
  return Boolean(
    config.GOOGLE_OAUTH_CLIENT_ID && config.GOOGLE_OAUTH_CLIENT_SECRET && config.AUTH_SECRET,
  );
}

export function googleAuthorizationUrl(request: Request, state: string, nonce: string): string {
  const clientId = bindings().GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("Google OAuth is not configured.");
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", googleCallbackUrl(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function completeGoogleLogin(
  request: Request,
  code: string,
  signedNonce: string | null,
): Promise<{ profile: AuthProfile; sessionToken: string }> {
  const config = bindings();
  if (!config.GOOGLE_OAUTH_CLIENT_ID || !config.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error("Google OAuth is not configured.");
  }
  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: config.GOOGLE_OAUTH_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: googleCallbackUrl(request),
    }),
  });
  if (!tokenResponse.ok) throw new Error("Google token exchange failed.");
  const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;
  if (typeof tokenPayload.id_token !== "string") {
    throw new Error("Google token exchange returned no identity token.");
  }

  const claims = await verifyGoogleIdToken(tokenPayload.id_token, config.GOOGLE_OAUTH_CLIENT_ID);
  if (typeof claims.nonce !== "string" || !(await verifyOAuthState(claims.nonce, signedNonce))) {
    throw new Error("Google identity token nonce is invalid.");
  }
  const normalized = validatedGoogleClaims(claims, config.GOOGLE_OAUTH_CLIENT_ID);
  const profile = await resolveProviderProfile(config.DB, {
    provider: "google",
    subject: normalized.subject,
    displayName: normalized.displayName,
    websiteUrl: null,
    email: normalized.email,
    emailVerified: true,
  });
  const sessionToken = await createAuthSession(config.DB, profile.id);
  return { profile, sessionToken };
}

export function googleCallbackUrl(request: Request): string {
  return new URL("/api/auth/google/callback", request.url).toString();
}

async function verifyGoogleIdToken(idToken: string, audience: string): Promise<GoogleIdClaims> {
  const segments = idToken.split(".");
  if (segments.length !== 3) throw new Error("Google identity token is malformed.");
  const header = decodeJwtSegment<GoogleJwtHeader>(segments[0]);
  const claims = decodeJwtSegment<GoogleIdClaims>(segments[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("Google identity token algorithm is invalid.");
  }

  const jwksResponse = await fetch(GOOGLE_JWKS_ENDPOINT, {
    headers: { accept: "application/json" },
  });
  if (!jwksResponse.ok) throw new Error("Google signing keys could not be loaded.");
  const jwks = (await jwksResponse.json()) as GoogleJwks;
  const jwk = jwks.keys?.find(
    (candidate) => candidate.kid === header.kid && candidate.alg === "RS256",
  );
  if (!jwk) throw new Error("Google identity token signing key is unavailable.");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(segments[2]),
    new TextEncoder().encode(`${segments[0]}.${segments[1]}`),
  );
  if (!verified) throw new Error("Google identity token signature is invalid.");
  validatedGoogleClaims(claims, audience);
  return claims;
}

function decodeJwtSegment<T>(value: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
  } catch {
    throw new Error("Google identity token contains invalid JSON.");
  }
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
