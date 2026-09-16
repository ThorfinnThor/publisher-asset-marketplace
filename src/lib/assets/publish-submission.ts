import { normalizePublicHttpsUrl } from "../submissions/validate";

export type PublishableSubmission = {
  id: string;
  creator_id: string;
  canonical_url: string;
  embed_url: string;
  preview_url: string | null;
  asset_type: "chart" | "calculator" | "table" | "dataset" | "benchmark" | "widget";
  title: string;
  description: string;
  attribution_name: string;
  attribution_url: string;
  attribution_terms: string;
  opportunity_topic?: string | null;
  declared_rights_json: string;
  created_at: string;
  authorization_version: number;
};

export type PublishReview = {
  reviewed_by: string;
  rights_status: "safe" | "restricted";
  rights_reason_code: string;
  rights_evidence_url: string;
  title: string | null;
  description: string | null;
  attribution_name: string | null;
  attribution_terms: string | null;
  reviewed_at: string;
  sandbox_tested: true;
};

export type CreatorAssetRecord = {
  id: string;
  creator_id: string;
  slug: string;
  asset_type: PublishableSubmission["asset_type"];
  title: string;
  description: string;
  canonical_url: string;
  canonical_url_normalized: string;
  embed_url: string;
  embed_origin: string;
  preview_url: string;
  citation_text: string;
  attribution_name: string;
  attribution_url: string;
  attribution_terms: string;
  rights_status: PublishReview["rights_status"];
  rights_json: string;
  metadata_json: string;
  search_document: string;
  created_at: string;
  updated_at: string;
  last_checked_at: string;
};

export type PublishValidationResult =
  { ok: true; value: CreatorAssetRecord } | { ok: false; code: string };

export function creatorAssetSlug(title: string, submissionId: string): string {
  const normalizedTitle = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  const suffix =
    submissionId
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase()
      .slice(0, 12) || "asset";
  return `creator-${normalizedTitle || "asset"}-${suffix}`;
}

export function buildCreatorAssetRecord(
  submission: PublishableSubmission,
  review: PublishReview,
): PublishValidationResult {
  if (review.sandbox_tested !== true) {
    return { ok: false, code: "promotion_sandbox_test_required" };
  }
  const canonical = normalizePublicHttpsUrl(submission.canonical_url);
  const embed = normalizePublicHttpsUrl(submission.embed_url);
  if (!submission.preview_url) return { ok: false, code: "promotion_preview_required" };
  const preview = normalizePublicHttpsUrl(submission.preview_url);
  const attribution = normalizePublicHttpsUrl(submission.attribution_url);
  const evidence = normalizePublicHttpsUrl(review.rights_evidence_url);
  if (!canonical.ok || !embed.ok || !preview.ok || !attribution.ok || !evidence.ok) {
    return { ok: false, code: "promotion_url_invalid" };
  }

  const title = review.title ?? submission.title;
  const description = review.description ?? submission.description;
  const attributionName = review.attribution_name ?? submission.attribution_name;
  const attributionTerms = review.attribution_terms ?? submission.attribution_terms;
  if (
    !isPlainText(title, 3, 160) ||
    !isPlainText(description, 20, 2_000) ||
    !isPlainText(attributionName, 2, 120) ||
    !isPlainText(attributionTerms, 2, 1_000)
  ) {
    return { ok: false, code: "promotion_text_invalid" };
  }

  const declared = parseDeclaredRights(submission.declared_rights_json);
  if (
    submission.authorization_version >= 2 &&
    (!declared.source_identity_confirmed ||
      !declared.attribution_confirmed ||
      !declared.preview_display_authorized ||
      !declared.submitter_authorized)
  ) {
    return { ok: false, code: "promotion_creator_confirmations_required" };
  }
  if (submission.authorization_version >= 3 && !declared.commercial_marketplace_acknowledged) {
    return { ok: false, code: "promotion_commercial_marketplace_acknowledgement_required" };
  }
  if (
    submission.authorization_version >= 4 &&
    (!declared.creator_terms_accepted || !declared.creator_terms_version)
  ) {
    return { ok: false, code: "promotion_creator_terms_acceptance_required" };
  }
  const embedOrigin = new URL(embed.value).origin;
  const rights = {
    schema_version: 1,
    embed_allowed: declared.embed_allowed,
    commercial_use: declared.commercial_use,
    modification_allowed: declared.modification_allowed,
    citation_required: declared.citation_required,
    raw_data_redistribution: null,
    share_alike: null,
    attribution_required: true,
    attribution_terms: attributionTerms,
    evidence_url: evidence.value,
    evidence_checked_at: review.reviewed_at,
    reviewed_rights_status: review.rights_status,
    rights_reason_code: review.rights_reason_code,
    sandbox_compatible: true,
    sandbox_profile: "v1:allow-scripts",
    sandbox_tested_at: review.reviewed_at,
  };
  const metadata = {
    source: "creator_submission",
    submission_id: submission.id,
    authorization_version: submission.authorization_version,
    reviewed_by: review.reviewed_by,
    reviewed_at: review.reviewed_at,
    rights_evidence_url: evidence.value,
    rights_reason_code: review.rights_reason_code,
    embed_origin: embedOrigin,
    sandbox_profile: "v1:allow-scripts",
    sandbox_tested_at: review.reviewed_at,
    opportunity_topic: submission.opportunity_topic ?? null,
    source_scan_id: declared.source_scan_id,
  };

  return {
    ok: true,
    value: {
      id: `asset_creator_${submission.id}`,
      creator_id: submission.creator_id,
      slug: creatorAssetSlug(title, submission.id),
      asset_type: submission.asset_type,
      title,
      description,
      canonical_url: canonical.value,
      canonical_url_normalized: canonical.value,
      embed_url: embed.value,
      embed_origin: embedOrigin,
      preview_url: preview.value,
      citation_text: `Source: ${attributionName}. ${title}. ${canonical.value}`,
      attribution_name: attributionName,
      attribution_url: attribution.value,
      attribution_terms: attributionTerms,
      rights_status: review.rights_status,
      rights_json: JSON.stringify(rights),
      metadata_json: JSON.stringify(metadata),
      search_document: [title, description, submission.asset_type, attributionName]
        .filter(Boolean)
        .join(" "),
      created_at: submission.created_at,
      updated_at: review.reviewed_at,
      last_checked_at: review.reviewed_at,
    },
  };
}

function parseDeclaredRights(value: string): {
  embed_allowed: boolean;
  commercial_use: boolean;
  modification_allowed: boolean;
  citation_required: boolean;
  source_identity_confirmed: boolean;
  attribution_confirmed: boolean;
  preview_display_authorized: boolean;
  submitter_authorized: boolean;
  commercial_marketplace_acknowledged: boolean;
  creator_terms_accepted: boolean;
  creator_terms_version: string | null;
  source_scan_id: string | null;
} {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        embed_allowed: false,
        commercial_use: false,
        modification_allowed: false,
        citation_required: false,
        source_identity_confirmed: false,
        attribution_confirmed: false,
        preview_display_authorized: false,
        submitter_authorized: false,
        commercial_marketplace_acknowledged: false,
        creator_terms_accepted: false,
        creator_terms_version: null,
        source_scan_id: null,
      };
    }
    const rights = parsed as Record<string, unknown>;
    return {
      embed_allowed: rights.embed_allowed === true,
      commercial_use: rights.commercial_use === true,
      modification_allowed: rights.modification_allowed === true,
      citation_required: rights.citation_required === true,
      source_identity_confirmed: rights.source_identity_confirmed === true,
      attribution_confirmed: rights.attribution_confirmed === true,
      preview_display_authorized: rights.preview_display_authorized === true,
      submitter_authorized: rights.submitter_authorized === true,
      commercial_marketplace_acknowledged: rights.commercial_marketplace_acknowledged === true,
      creator_terms_accepted: rights.creator_terms_accepted === true,
      creator_terms_version:
        typeof rights.creator_terms_version === "string" && rights.creator_terms_version.length > 0
          ? rights.creator_terms_version
          : null,
      source_scan_id: typeof rights.source_scan_id === "string" ? rights.source_scan_id : null,
    };
  } catch {
    return {
      embed_allowed: false,
      commercial_use: false,
      modification_allowed: false,
      citation_required: false,
      source_identity_confirmed: false,
      attribution_confirmed: false,
      preview_display_authorized: false,
      submitter_authorized: false,
      commercial_marketplace_acknowledged: false,
      creator_terms_accepted: false,
      creator_terms_version: null,
      source_scan_id: null,
    };
  }
}

function isPlainText(value: string, minimum: number, maximum: number): boolean {
  const normalized = value.normalize("NFC").trim();
  return (
    normalized === value &&
    normalized.length >= minimum &&
    normalized.length <= maximum &&
    !/[\u0000-\u001F\u007F-\u009F]/.test(normalized)
  );
}
