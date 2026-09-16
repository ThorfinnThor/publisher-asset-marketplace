const forbiddenHostnameSuffixes = [".internal", ".local", ".localhost", ".test"];

export type UrlValidationResult =
  | { ok: true; url: string; hostname: string }
  | { ok: false; code: "invalid_url" | "address_not_public" };

export function normalizePublicHttpsUrl(input: unknown): UrlValidationResult {
  if (typeof input !== "string" || input.length > 2_048) {
    return { ok: false, code: "invalid_url" };
  }

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, code: "invalid_url" };
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    (url.port !== "" && url.port !== "443") ||
    url.hostname.length === 0
  ) {
    return { ok: false, code: "invalid_url" };
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    (!hostname.includes(".") && !hostname.includes(":")) ||
    forbiddenHostnameSuffixes.some((suffix) => hostname.endsWith(suffix)) ||
    isNonPublicIp(hostname)
  ) {
    return { ok: false, code: "address_not_public" };
  }

  url.hash = "";
  url.hostname = hostname;
  return { ok: true, url: url.toString(), hostname };
}

export function browserGuardrailDomains(requestedUrl: string): string[] {
  const hostname = new URL(requestedUrl).hostname.toLowerCase();
  if (hostname.includes(":") || /^\d+\.\d+\.\d+\.\d+$/u.test(hostname)) return [hostname];
  return [hostname, `*.${hostname}`];
}

export function isNonPublicIp(input: string): boolean {
  const value = input.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  const ipv4 = parseIpv4(value);
  if (ipv4) return isNonPublicIpv4(ipv4);
  if (!value.includes(":")) return false;

  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value)) return true;
  if (value.startsWith("ff")) return true;
  if (value.startsWith("2001:db8:")) return true;
  if (value.startsWith("2001:10:")) return true;

  const mappedIpv4 = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIpv4 ? isNonPublicIpv4(parseIpv4(mappedIpv4) ?? [0, 0, 0, 0]) : false;
}

function parseIpv4(value: string): [number, number, number, number] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return octets as [number, number, number, number];
}

function isNonPublicIpv4([a, b, c]: [number, number, number, number]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}
