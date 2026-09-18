const allowedIssuers = new Set(["accounts.google.com", "https://accounts.google.com"]);

export type GoogleIdClaims = {
  iss?: unknown;
  aud?: unknown;
  azp?: unknown;
  sub?: unknown;
  exp?: unknown;
  iat?: unknown;
  nonce?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  picture?: unknown;
};

export function validatedGoogleClaims(
  claims: GoogleIdClaims,
  audience: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): { subject: string; email: string; displayName: string } {
  if (typeof claims.iss !== "string" || !allowedIssuers.has(claims.iss)) {
    throw new Error("Google identity token issuer is invalid.");
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience)) {
    throw new Error("Google identity token audience is invalid.");
  }
  if (audiences.length > 1 && claims.azp !== audience) {
    throw new Error("Google identity token authorized party is invalid.");
  }
  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds - 60) {
    throw new Error("Google identity token has expired.");
  }
  if (typeof claims.iat !== "number" || claims.iat > nowSeconds + 60) {
    throw new Error("Google identity token issue time is invalid.");
  }
  if (typeof claims.sub !== "string" || !/^[0-9]{1,255}$/u.test(claims.sub)) {
    throw new Error("Google identity token subject is invalid.");
  }
  if (claims.email_verified !== true || typeof claims.email !== "string") {
    throw new Error("Google account email is not verified.");
  }
  const email = claims.email.normalize("NFKC").trim().toLocaleLowerCase("en");
  if (!/^\S+@\S+\.\S+$/u.test(email) || email.length > 320) {
    throw new Error("Google account email is invalid.");
  }
  const displayName =
    typeof claims.name === "string" && claims.name.trim().length > 0
      ? claims.name.normalize("NFC").trim().slice(0, 120)
      : email.split("@")[0].slice(0, 120);
  return { subject: claims.sub, email, displayName };
}
