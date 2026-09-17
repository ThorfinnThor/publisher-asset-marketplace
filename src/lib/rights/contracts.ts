export type TriState = true | false | null;

export type RightsStatus = "safe" | "restricted" | "unknown" | "blocked";

export type SupportedLicense =
  | "CC0_1_0"
  | "PUBLIC_DOMAIN"
  | "CC_BY"
  | "CC_BY_SA"
  | "CC_BY_ND"
  | "CC_BY_NC"
  | "CC_BY_NC_SA"
  | "CC_BY_NC_ND"
  | "EU_COMMISSION_REUSE_2011"
  | "ALL_RIGHTS_RESERVED"
  | "CUSTOM_OR_UNKNOWN";

export type RightsReasonCode =
  | "missing_audit_evidence"
  | "conflicting_evidence"
  | "explicit_reuse_prohibition"
  | "official_embed_unavailable"
  | "all_rights_reserved"
  | "unknown_chart_owner"
  | "chart_license_not_explicit"
  | "third_party_review_required"
  | "unknown_chart_license"
  | "unknown_embed_capability"
  | "share_alike_required"
  | "no_derivatives"
  | "noncommercial_only"
  | "noncommercial_share_alike"
  | "noncommercial_no_derivatives"
  | "raw_data_non_redistributable"
  | "verified_permissive_chart"
  | "manually_verified_third_party"
  | "unmatched_evidence";

export type AssetRights = {
  embed_allowed: TriState;
  marketplace_rendered_embed_allowed?: TriState;
  embed_provenance?: "source_hosted" | "marketplace_rendered" | null;
  embed_review_version?: string | null;
  commercial_use: TriState;
  modification_allowed: TriState;
  citation_required: TriState;
  raw_data_redistribution: TriState;
  share_alike: TriState;
  attribution_required: TriState;
  evidence_url: string | null;
  evidence_checked_at: string | null;
};

export const unknownRights: AssetRights = {
  embed_allowed: null,
  commercial_use: null,
  modification_allowed: null,
  citation_required: null,
  raw_data_redistribution: null,
  share_alike: null,
  attribution_required: null,
  evidence_url: null,
  evidence_checked_at: null,
};
