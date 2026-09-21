import { describe, expect, it, vi } from "vitest";

import { verifyMarketplacePreviewUpload } from "../src/lib/submissions/marketplace-preview";

const internalUrl =
  "https://citesupply.com/api/submission-previews/11111111-1111-4111-8111-111111111111";

function bucketWithHead(value: unknown): R2Bucket {
  return { head: vi.fn().mockResolvedValue(value) } as unknown as R2Bucket;
}

function storedPreview(overrides: Record<string, unknown> = {}): R2Object {
  return {
    key: "submission-previews/11111111-1111-4111-8111-111111111111",
    size: 512,
    etag: "etag",
    httpEtag: '"etag"',
    uploaded: new Date("2026-09-19T00:00:00.000Z"),
    checksums: {},
    httpMetadata: { contentType: "image/png" },
    customMetadata: { creatorId: "creator-1", imageValidation: "signature-v1" },
    storageClass: "Standard",
    ...overrides,
  } as unknown as R2Object;
}

describe("marketplace preview verification", () => {
  it("does not inspect external preview URLs", async () => {
    const bucket = bucketWithHead(null);
    await expect(
      verifyMarketplacePreviewUpload(
        bucket,
        "https://cdn.example/preview.png",
        "https://citesupply.com",
        "creator-1",
      ),
    ).resolves.toEqual({ kind: "external" });
    expect(bucket.head).not.toHaveBeenCalled();
  });

  it("rejects missing and wrong-owner internal uploads", async () => {
    await expect(
      verifyMarketplacePreviewUpload(
        bucketWithHead(null),
        internalUrl,
        "https://citesupply.com",
        "creator-1",
      ),
    ).resolves.toMatchObject({ kind: "invalid", code: "preview_upload_missing" });
    await expect(
      verifyMarketplacePreviewUpload(
        bucketWithHead(
          storedPreview({
            customMetadata: { creatorId: "creator-2", imageValidation: "signature-v1" },
          }),
        ),
        internalUrl,
        "https://citesupply.com",
        "creator-1",
      ),
    ).resolves.toMatchObject({ kind: "invalid", code: "preview_upload_not_owned" });
  });

  it("accepts signature-validated uploads owned by the creator", async () => {
    await expect(
      verifyMarketplacePreviewUpload(
        bucketWithHead(storedPreview()),
        internalUrl,
        "https://citesupply.com",
        "creator-1",
      ),
    ).resolves.toEqual({
      kind: "verified",
      key: "submission-previews/11111111-1111-4111-8111-111111111111",
    });
  });

  it("fails closed when R2 verification is unavailable", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const bucket = {
      head: vi.fn().mockRejectedValue(new Error("temporary R2 failure")),
    } as unknown as R2Bucket;
    try {
      await expect(
        verifyMarketplacePreviewUpload(bucket, internalUrl, "https://citesupply.com", "creator-1"),
      ).resolves.toMatchObject({ kind: "unavailable", code: "preview_storage_unavailable" });
    } finally {
      errorLog.mockRestore();
    }
  });
});
