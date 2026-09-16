export const urlScanContractV1 = {
  version: 1,
  statuses: [
    "queued",
    "running",
    "needs_confirmation",
    "needs_changes",
    "failed",
    "expired",
    "converted",
  ],
  terminalStatuses: ["failed", "expired", "converted"],
  limits: {
    requestBodyBytes: 8 * 1024,
    scansPerCreatorPer24Hours: 10,
    activeScansPerCreator: 1,
    attempts: 3,
    redirects: 3,
    navigationTimeoutMs: 10_000,
    jobTimeoutMs: 30_000,
    mainDocumentBytes: 2 * 1024 * 1024,
    aggregateDeclaredBytes: 12 * 1024 * 1024,
    requests: 80,
    resultJsonBytes: 64 * 1024,
    previewBytes: 2 * 1024 * 1024,
    unconfirmedPreviewTtlDays: 7,
    inactiveJobTtlDays: 30,
  },
  sandboxProfile: "v1:allow-scripts",
  resultSchemaVersion: 1,
  autoPublish: false,
} as const;

export type UrlScanStatus = (typeof urlScanContractV1.statuses)[number];

export type UrlScanIssueCode =
  | "address_not_public"
  | "authentication_required"
  | "consent_blocked"
  | "dns_unavailable"
  | "embed_not_found"
  | "frame_blocked"
  | "navigation_timeout"
  | "ownership_unconfirmed"
  | "preview_failed"
  | "prompt_injection_ignored"
  | "redirect_limit"
  | "request_limit"
  | "response_too_large"
  | "rights_evidence_missing"
  | "robots_disallowed"
  | "sandbox_not_interactive"
  | "sandbox_runtime_error"
  | "unsupported_content_type";

export type UrlScanResultV1 = {
  schema_version: 1;
  final_url: string;
  canonical_url_candidate: string | null;
  asset_type_candidate:
    "chart" | "calculator" | "table" | "dataset" | "benchmark" | "widget" | null;
  title_candidate: string | null;
  description_candidate: string | null;
  attribution_name_candidate: string | null;
  attribution_url_candidate: string | null;
  embed: {
    candidate_url: string | null;
    discovery: "manifest" | "link" | "iframe" | "canonical_fallback" | "none";
    sandbox_profile: "v1:allow-scripts";
    status: "pass" | "blocked" | "unknown";
  };
  preview: {
    r2_key: string | null;
    content_type: "image/png" | "image/jpeg" | null;
    width: number | null;
    height: number | null;
    creator_confirmation_required: true;
  };
  rights_candidates: {
    evidence_url: string | null;
    embed_allowed: boolean | null;
    commercial_use: boolean | null;
    modification_allowed: boolean | null;
    citation_required: boolean | null;
    verification_status: "unverified";
  };
  issues: Array<{ code: UrlScanIssueCode; field: string | null }>;
  raw_content_stored: false;
  auto_publish: false;
};
