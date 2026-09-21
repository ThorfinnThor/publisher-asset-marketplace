import { runSubmissionPreScreen, type SubmissionPreScreenResult } from "./pre-screen";
import { verifyMarketplacePreviewUpload } from "./marketplace-preview";
import type { ValidatedSubmission } from "./validate";

export type VerifiedPreScreenResult =
  | { ok: true; preScreen: SubmissionPreScreenResult }
  | {
      ok: false;
      status: 422 | 503;
      code: string;
      message: string;
      field: "preview_url";
    };

export async function runVerifiedSubmissionPreScreen(
  submission: ValidatedSubmission,
  options: {
    marketplaceOrigin: string;
    creatorId: string;
    previewBucket: R2Bucket;
  },
): Promise<VerifiedPreScreenResult> {
  const verification = await verifyMarketplacePreviewUpload(
    options.previewBucket,
    submission.previewUrl,
    options.marketplaceOrigin,
    options.creatorId,
  );
  if (verification.kind === "invalid" || verification.kind === "unavailable") {
    return {
      ok: false,
      status: verification.kind === "unavailable" ? 503 : 422,
      code: verification.code,
      message: verification.message,
      field: "preview_url",
    };
  }
  return {
    ok: true,
    preScreen: runSubmissionPreScreen(submission, {
      marketplaceOrigin: options.marketplaceOrigin,
      marketplacePreviewVerified: verification.kind === "verified",
    }),
  };
}

export function previewVerificationErrorBody(
  result: Exclude<VerifiedPreScreenResult, { ok: true }>,
): { error: string; code: string; field_errors: Record<string, string> } {
  return {
    error: result.message,
    code: result.code,
    field_errors: { [result.field]: result.message },
  };
}
