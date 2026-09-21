import { marketplacePreviewObjectKey } from "../assets/delete-creator-asset";

const maxImageBytes = 2 * 1024 * 1024;
const allowedContentTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export type MarketplacePreviewVerification =
  | { kind: "external" }
  | { kind: "verified"; key: string }
  | {
      kind: "invalid";
      code: "preview_upload_missing" | "preview_upload_not_owned" | "preview_upload_invalid";
      message: string;
    }
  | { kind: "unavailable"; code: "preview_storage_unavailable"; message: string };

export async function verifyMarketplacePreviewUpload(
  bucket: R2Bucket,
  previewUrl: string,
  marketplaceOrigin: string,
  creatorId: string,
): Promise<MarketplacePreviewVerification> {
  const key = marketplacePreviewObjectKey(previewUrl, marketplaceOrigin);
  if (!key) return { kind: "external" };

  let object: R2Object | null;
  try {
    object = await bucket.head(key);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "marketplace_preview_verification_failed",
        key,
        message: error instanceof Error ? error.message : "unknown_error",
      }),
    );
    return {
      kind: "unavailable",
      code: "preview_storage_unavailable",
      message: "The uploaded preview could not be verified. Please try again.",
    };
  }
  if (!object) {
    return {
      kind: "invalid",
      code: "preview_upload_missing",
      message: "The uploaded preview no longer exists. Upload it again.",
    };
  }
  if (object.customMetadata?.creatorId !== creatorId) {
    return {
      kind: "invalid",
      code: "preview_upload_not_owned",
      message: "This uploaded preview does not belong to your creator account.",
    };
  }

  const contentType = object.httpMetadata?.contentType?.toLowerCase() ?? "";
  const validation = object.customMetadata?.imageValidation;
  const legacyValidatedUpload =
    validation === undefined && Boolean(object.customMetadata?.uploadedAt);
  if (
    object.size <= 0 ||
    object.size > maxImageBytes ||
    !allowedContentTypes.has(contentType) ||
    (validation !== "signature-v1" && !legacyValidatedUpload)
  ) {
    return {
      kind: "invalid",
      code: "preview_upload_invalid",
      message: "The uploaded preview did not pass image validation. Upload it again.",
    };
  }
  return { kind: "verified", key };
}
