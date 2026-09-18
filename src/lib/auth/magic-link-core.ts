const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/u;

export const magicLinkLifetimeMinutes = 15;
export const magicLinkEmailHourlyLimit = 5;
export const magicLinkIpHourlyLimit = 20;

export function normalizeMagicLinkEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim().toLocaleLowerCase("en");
  if (normalized.length < 3 || normalized.length > 254 || !emailPattern.test(normalized)) {
    return null;
  }
  return normalized;
}

export function normalizeMagicLinkAppOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function createMagicLinkToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function validMagicLinkToken(value: unknown): value is string {
  return typeof value === "string" && tokenPattern.test(value);
}

export function magicLinkDisplayName(email: string): string {
  const localPart = email
    .split("@", 1)[0]
    ?.replaceAll(/[._+-]+/gu, " ")
    .trim();
  return (localPart || "Creator").slice(0, 120);
}

export function magicLinkIdentitySeed(normalizedEmail: string): string {
  return `email-identity:${normalizedEmail}`;
}

export function magicLinkFragmentUrl(appOrigin: string, token: string): string {
  const url = new URL("/auth/email", appOrigin);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

export function sameOriginAuthRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return Boolean(
    origin && origin === new URL(request.url).origin && (!fetchSite || fetchSite === "same-origin"),
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
