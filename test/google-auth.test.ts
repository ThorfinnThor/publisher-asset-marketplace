import { describe, expect, it } from "vitest";

import { validatedGoogleClaims, type GoogleIdClaims } from "../src/lib/auth/google-claims";

const audience = "marketplace-client-id";
const now = 1_800_000_000;

function validClaims(overrides: Partial<GoogleIdClaims> = {}): GoogleIdClaims {
  return {
    iss: "https://accounts.google.com",
    aud: audience,
    sub: "123456789012345678901",
    exp: now + 600,
    iat: now - 30,
    email: " Creator@Example.COM ",
    email_verified: true,
    name: "Example Creator",
    ...overrides,
  };
}

describe("Google OIDC claim validation", () => {
  it("accepts a valid token and normalizes the verified identity", () => {
    expect(validatedGoogleClaims(validClaims(), audience, now)).toEqual({
      subject: "123456789012345678901",
      email: "creator@example.com",
      displayName: "Example Creator",
    });
  });

  it.each([
    ["issuer", { iss: "https://attacker.example" }],
    ["audience", { aud: "other-client" }],
    ["expiry", { exp: now - 61 }],
    ["future issue time", { iat: now + 61 }],
    ["subject", { sub: "not-numeric" }],
    ["verified email", { email_verified: false }],
  ])("rejects an invalid %s", (_label, overrides) => {
    expect(() => validatedGoogleClaims(validClaims(overrides), audience, now)).toThrow();
  });

  it("accepts a Google token with the client ID in an audience list", () => {
    expect(
      validatedGoogleClaims(
        validClaims({ aud: ["another-client", audience], azp: audience }),
        audience,
        now,
      ).subject,
    ).toBe("123456789012345678901");
  });

  it("requires the authorized party when more than one audience is present", () => {
    expect(() =>
      validatedGoogleClaims(validClaims({ aud: ["another-client", audience] }), audience, now),
    ).toThrow(/authorized party/u);
  });

  it("uses the verified email prefix when no display name is available", () => {
    expect(validatedGoogleClaims(validClaims({ name: "" }), audience, now).displayName).toBe(
      "creator",
    );
  });
});
