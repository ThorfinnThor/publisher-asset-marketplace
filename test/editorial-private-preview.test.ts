import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  getVerifiedPrivateEditorialPreview,
  privateEditorialPreviewHeaders,
} from "../src/lib/editorial/private-preview";

describe("private editorial preview artifacts", () => {
  it.each([
    [
      "cb-002-eu-renewable-share-patterns",
      "9c405aff27dfa7c8b1f7fb3ef5c3c50d450781a6ed910070739fed972a211323",
    ],
    [
      "cb-003-hicp-inflation-explainer",
      "8e4585c6a4536ee61f2eb8cec484048fb11df27662695b5a08dbc1ca74a2694d",
    ],
  ])("serves only a hash-bound reviewed artifact for %s", async (briefId, expectedSha256) => {
    const preview = await getVerifiedPrivateEditorialPreview(briefId);
    expect(preview).not.toBeNull();
    expect(
      createHash("sha256")
        .update(preview?.html ?? "")
        .digest("hex"),
    ).toBe(expectedSha256);
    expect(preview?.html).toContain('name="robots" content="noindex,nofollow,noarchive"');
    expect(preview?.html).toContain("Private editorial review");
  });

  it("returns no artifact for an unapproved brief", async () => {
    await expect(getVerifiedPrivateEditorialPreview("cb-999-unapproved")).resolves.toBeNull();
  });

  it("defines defence-in-depth response headers at the route boundary", () => {
    const headers = privateEditorialPreviewHeaders();
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(headers.get("referrer-policy")).toBe("no-referrer");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
  });
});
