import { normalizePublicHttpsUrl } from "../submissions/validate";

const decisions = new Set(["approved", "rejected", "needs_changes"]);
const rightsStatuses = new Set(["safe", "restricted", "unknown", "blocked"]);
const reviewKeys = new Set([
  "decision",
  "review_notes",
  "rights_status",
  "rights_reason_code",
  "rights_evidence_url",
  "title",
  "description",
  "attribution_name",
  "attribution_terms",
  "sandbox_tested",
]);

export type ReviewDecision = "approved" | "rejected" | "needs_changes";
export type ReviewRightsStatus = "safe" | "restricted" | "unknown" | "blocked";

export type ValidatedReview = {
  decision: ReviewDecision;
  reviewNotes: string;
  rightsStatus: ReviewRightsStatus;
  rightsReasonCode: string;
  rightsEvidenceUrl: string | null;
  title: string | null;
  description: string | null;
  attributionName: string | null;
  attributionTerms: string | null;
  sandboxTested: boolean;
};

export type ReviewValidationResult =
  { ok: true; value: ValidatedReview } | { ok: false; code: string; field?: string };

export function validateReviewPayload(input: unknown): ReviewValidationResult {
  if (!isRecord(input)) return { ok: false, code: "invalid_payload" };
  for (const key of Object.keys(input)) {
    if (!reviewKeys.has(key)) return { ok: false, code: "unknown_field", field: key };
  }

  if (typeof input.decision !== "string" || !decisions.has(input.decision)) {
    return { ok: false, code: "invalid_decision", field: "decision" };
  }
  if (typeof input.rights_status !== "string" || !rightsStatuses.has(input.rights_status)) {
    return { ok: false, code: "invalid_rights_status", field: "rights_status" };
  }

  const reviewNotes = normalizePlainText(input.review_notes, 10, 2_000);
  if (!reviewNotes.ok) return { ...reviewNotes, field: "review_notes" };
  const rightsReasonCode = normalizePlainText(input.rights_reason_code, 2, 120);
  if (!rightsReasonCode.ok) return { ...rightsReasonCode, field: "rights_reason_code" };

  const title = optionalPlainText(input.title, 3, 160);
  if (!title.ok) return { ...title, field: "title" };
  const description = optionalPlainText(input.description, 20, 2_000);
  if (!description.ok) return { ...description, field: "description" };
  const attributionName = optionalPlainText(input.attribution_name, 2, 120);
  if (!attributionName.ok) return { ...attributionName, field: "attribution_name" };
  const attributionTerms = optionalPlainText(input.attribution_terms, 2, 1_000);
  if (!attributionTerms.ok) return { ...attributionTerms, field: "attribution_terms" };

  const evidence =
    input.rights_evidence_url === null || input.rights_evidence_url === undefined
      ? ({ ok: true, value: null } as const)
      : normalizePublicHttpsUrl(input.rights_evidence_url);
  if (!evidence.ok) return { ...evidence, field: "rights_evidence_url" };

  if (input.decision === "approved" && input.rights_status === "blocked") {
    return { ok: false, code: "blocked_asset_cannot_approve", field: "rights_status" };
  }
  if (typeof input.sandbox_tested !== "boolean") {
    return { ok: false, code: "boolean_required", field: "sandbox_tested" };
  }
  if (input.decision === "approved" && input.sandbox_tested !== true) {
    return { ok: false, code: "sandbox_test_required", field: "sandbox_tested" };
  }
  if (
    input.decision === "approved" &&
    ((input.rights_status !== "safe" && input.rights_status !== "restricted") || !evidence.value)
  ) {
    return { ok: false, code: "approved_rights_evidence_required", field: "rights_evidence_url" };
  }

  return {
    ok: true,
    value: {
      decision: input.decision as ReviewDecision,
      reviewNotes: reviewNotes.value,
      rightsStatus: input.rights_status as ReviewRightsStatus,
      rightsReasonCode: rightsReasonCode.value,
      rightsEvidenceUrl: evidence.value,
      title: title.value,
      description: description.value,
      attributionName: attributionName.value,
      attributionTerms: attributionTerms.value,
      sandboxTested: input.sandbox_tested,
    },
  };
}

export function isReviewableStatus(value: string): value is "pending" | "needs_changes" {
  return value === "pending" || value === "needs_changes";
}

function normalizePlainText(
  input: unknown,
  minimum: number,
  maximum: number,
): { ok: true; value: string } | { ok: false; code: string } {
  if (typeof input !== "string") return { ok: false, code: "text_required" };
  const value = input.normalize("NFC").trim();
  if (/[\u0000-\u001F\u007F-\u009F]/.test(value)) {
    return { ok: false, code: "control_character" };
  }
  if (value.length < minimum) return { ok: false, code: "text_too_short" };
  if (value.length > maximum) return { ok: false, code: "text_too_long" };
  return { ok: true, value };
}

function optionalPlainText(
  input: unknown,
  minimum: number,
  maximum: number,
): { ok: true; value: string | null } | { ok: false; code: string } {
  if (input === undefined || input === null) return { ok: true, value: null };
  return normalizePlainText(input, minimum, maximum);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
