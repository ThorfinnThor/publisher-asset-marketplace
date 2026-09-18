import { describe, expect, it } from "vitest";

import { linkProviderIdentity } from "../src/lib/auth/identity";

const identity = {
  provider: "google" as const,
  subject: "123456789",
  displayName: "Google Creator",
  websiteUrl: null,
  email: "creator@example.com",
  emailVerified: true,
};

describe("provider identity linking", () => {
  it("refuses to move an identity owned by another profile", async () => {
    const db = {
      prepare(sql: string) {
        return {
          bind: (...values: unknown[]) => ({
            async run() {
              return { success: true };
            },
            async first<T>() {
              expect(sql).toContain("WHERE provider = ? AND provider_subject = ?");
              expect(values).toEqual(["google", "123456789"]);
              return { profile_id: "github:other" } as T;
            },
          }),
        };
      },
    } as unknown as D1Database;

    await expect(linkProviderIdentity(db, "github:current", identity)).resolves.toEqual({
      ok: false,
      reason: "identity_in_use",
    });
  });

  it("does not merge profiles when adding a previously unseen identity", async () => {
    const prepared: Array<{ sql: string; values: unknown[] }> = [];
    const profile = {
      id: "github:current",
      role: "creator" as const,
      display_name: "Existing Creator",
      website_url: null,
    };
    const db = {
      prepare(sql: string) {
        return {
          bind: (...values: unknown[]) => {
            prepared.push({ sql, values });
            return {
              async first<T>() {
                if (sql.includes("SELECT profile_id")) return { profile_id: "github:current" } as T;
                return profile as T;
              },
              async run() {
                return { success: true };
              },
            };
          },
        };
      },
    } as unknown as D1Database;

    await expect(linkProviderIdentity(db, "github:current", identity)).resolves.toMatchObject({
      ok: true,
      profile,
    });
    expect(prepared[0]?.sql).toContain("INSERT INTO auth_identities");
    expect(prepared[1]?.sql).toContain("SELECT profile_id");
    expect(prepared[2]?.sql).toContain("SELECT id, role, display_name, website_url");
  });
});
