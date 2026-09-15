import {
  type AssetRights,
  type RightsReasonCode,
  type RightsStatus,
  type SupportedLicense,
  type TriState,
} from "./contracts";

export type ChartOwner = "owid" | "third_party" | null;

export type IndicatorRightsEvidence = {
  indicator_url: string;
  non_redistributable: TriState;
  origins: Array<{
    license_code: SupportedLicense | null;
    license_raw: string | null;
    license_url: string | null;
  }>;
};

export type RightsEvidence = {
  chart_owner: ChartOwner;
  chart_license_code: SupportedLicense | null;
  chart_license_raw: string | null;
  chart_license_url: string | null;
  chart_license_explicit: boolean;
  manual_review_completed: boolean;
  embed_available: TriState;
  citation_only_allowed?: boolean;
  chart_reuse_prohibited: TriState;
  evidence_conflict: boolean;
  citation_available: boolean;
  indicator_evidence: IndicatorRightsEvidence[];
  evidence_url: string | null;
  evidence_checked_at: string | null;
};

export type RightsActions = {
  embed_copy: boolean;
  citation_copy: boolean;
  source_link: true;
  raw_data_action: boolean;
};

export type RightsClassification = {
  rights_status: RightsStatus;
  rights: AssetRights;
  reason_code: RightsReasonCode;
  chart_license: SupportedLicense | null;
  raw_data_redistribution: TriState;
  actions: RightsActions;
};

type LicensePermissions = {
  commercial_use: TriState;
  modification_allowed: TriState;
  attribution_required: TriState;
  citation_required: TriState;
  share_alike: TriState;
  base_status: RightsStatus;
  restricted_reason: RightsReasonCode | null;
};

const permissiveRawDataLicenses = new Set<SupportedLicense>([
  "CC0_1_0",
  "PUBLIC_DOMAIN",
  "CC_BY",
  "CC_BY_SA",
]);

const licensePermissions: Record<SupportedLicense, LicensePermissions> = {
  CC0_1_0: {
    commercial_use: true,
    modification_allowed: true,
    attribution_required: false,
    citation_required: false,
    share_alike: false,
    base_status: "safe",
    restricted_reason: null,
  },
  PUBLIC_DOMAIN: {
    commercial_use: true,
    modification_allowed: true,
    attribution_required: false,
    citation_required: false,
    share_alike: false,
    base_status: "safe",
    restricted_reason: null,
  },
  CC_BY: {
    commercial_use: true,
    modification_allowed: true,
    attribution_required: true,
    citation_required: true,
    share_alike: false,
    base_status: "safe",
    restricted_reason: null,
  },
  CC_BY_SA: {
    commercial_use: true,
    modification_allowed: true,
    attribution_required: true,
    citation_required: true,
    share_alike: true,
    base_status: "restricted",
    restricted_reason: "share_alike_required",
  },
  CC_BY_ND: {
    commercial_use: true,
    modification_allowed: false,
    attribution_required: true,
    citation_required: true,
    share_alike: false,
    base_status: "restricted",
    restricted_reason: "no_derivatives",
  },
  CC_BY_NC: {
    commercial_use: false,
    modification_allowed: true,
    attribution_required: true,
    citation_required: true,
    share_alike: false,
    base_status: "restricted",
    restricted_reason: "noncommercial_only",
  },
  CC_BY_NC_SA: {
    commercial_use: false,
    modification_allowed: true,
    attribution_required: true,
    citation_required: true,
    share_alike: true,
    base_status: "restricted",
    restricted_reason: "noncommercial_share_alike",
  },
  CC_BY_NC_ND: {
    commercial_use: false,
    modification_allowed: false,
    attribution_required: true,
    citation_required: true,
    share_alike: false,
    base_status: "restricted",
    restricted_reason: "noncommercial_no_derivatives",
  },
  ALL_RIGHTS_RESERVED: {
    commercial_use: false,
    modification_allowed: false,
    attribution_required: null,
    citation_required: null,
    share_alike: null,
    base_status: "blocked",
    restricted_reason: null,
  },
  CUSTOM_OR_UNKNOWN: {
    commercial_use: null,
    modification_allowed: null,
    attribution_required: null,
    citation_required: null,
    share_alike: null,
    base_status: "unknown",
    restricted_reason: null,
  },
};

function normalizeLicenseLabel(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase("en")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*\.\s*/g, ".");
}

export function normalizeSupportedLicense(value: string | null | undefined): SupportedLicense {
  if (!value || value.trim() === "") {
    return "CUSTOM_OR_UNKNOWN";
  }
  const label = normalizeLicenseLabel(value);

  if (/^CC0(?: 1\.0)?(?: INTERNATIONAL)?$/.test(label)) {
    return "CC0_1_0";
  }
  if (/^(?:PUBLIC DOMAIN|PUBLIC DOMAIN MARK|PDM)$/.test(label)) {
    return "PUBLIC_DOMAIN";
  }
  if (/^CC BY(?: (?:2\.0|2\.5|3\.0|4\.0)(?: DEED| INTERNATIONAL)?)?$/.test(label)) {
    return "CC_BY";
  }
  if (/^CC BY-SA(?: (?:2\.0|2\.5|3\.0|4\.0)(?: INTERNATIONAL)?)?$/.test(label)) {
    return "CC_BY_SA";
  }
  if (/^CC BY-ND(?: (?:2\.0|2\.5|3\.0|4\.0)(?: INTERNATIONAL)?)?$/.test(label)) {
    return "CC_BY_ND";
  }
  if (/^CC BY-NC(?: (?:2\.0|2\.5|3\.0|4\.0)(?: INTERNATIONAL)?)?$/.test(label)) {
    return "CC_BY_NC";
  }
  if (/^CC BY-NC-SA(?: (?:2\.0|2\.5|3\.0|4\.0)(?: INTERNATIONAL)?)?$/.test(label)) {
    return "CC_BY_NC_SA";
  }
  if (/^CC BY-NC-ND(?: (?:2\.0|2\.5|3\.0|4\.0)(?: INTERNATIONAL)?)?$/.test(label)) {
    return "CC_BY_NC_ND";
  }
  if (label === "ALL RIGHTS RESERVED") {
    return "ALL_RIGHTS_RESERVED";
  }
  return "CUSTOM_OR_UNKNOWN";
}

function effectiveLicense(evidence: RightsEvidence): SupportedLicense {
  if (evidence.chart_license_code && evidence.chart_license_code !== "CUSTOM_OR_UNKNOWN") {
    return evidence.chart_license_code;
  }
  return normalizeSupportedLicense(evidence.chart_license_raw);
}

function validEvidenceDate(value: string | null): boolean {
  if (!value || Number.isNaN(Date.parse(value))) {
    return false;
  }
  return /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value);
}

function hasAuditEvidence(evidence: RightsEvidence): boolean {
  return Boolean(evidence.evidence_url?.trim()) && validEvidenceDate(evidence.evidence_checked_at);
}

function aggregateRawDataRights(evidence: RightsEvidence): TriState {
  if (evidence.indicator_evidence.length === 0) {
    return null;
  }

  if (evidence.indicator_evidence.some((indicator) => indicator.non_redistributable === true)) {
    return false;
  }

  let allPermissive = true;
  for (const indicator of evidence.indicator_evidence) {
    if (indicator.non_redistributable === null || indicator.origins.length === 0) {
      return null;
    }
    for (const origin of indicator.origins) {
      const license = origin.license_code ?? normalizeSupportedLicense(origin.license_raw);
      if (!permissiveRawDataLicenses.has(license)) {
        allPermissive = false;
      }
    }
  }
  return allPermissive ? true : null;
}

function rightsFor(
  license: SupportedLicense,
  evidence: RightsEvidence,
  rawDataRights: TriState,
): AssetRights {
  const permissions = licensePermissions[license];
  const embedAllowed =
    evidence.chart_reuse_prohibited === true
      ? false
      : evidence.embed_available === null
        ? null
        : evidence.embed_available;
  return {
    embed_allowed: embedAllowed,
    commercial_use: permissions.commercial_use,
    modification_allowed: permissions.modification_allowed,
    citation_required: permissions.citation_required,
    raw_data_redistribution: rawDataRights,
    share_alike: permissions.share_alike,
    attribution_required: permissions.attribution_required,
    evidence_url: evidence.evidence_url,
    evidence_checked_at: evidence.evidence_checked_at,
  };
}

function actionPermissions(
  status: RightsStatus,
  rights: AssetRights,
  evidence: RightsEvidence,
): RightsActions {
  const actionStatus = status === "safe" || status === "restricted";
  return {
    embed_copy: actionStatus && rights.embed_allowed === true,
    citation_copy: actionStatus && evidence.citation_available,
    source_link: true,
    raw_data_action: actionStatus && rights.raw_data_redistribution === true,
  };
}

export function classifyRights(evidence: RightsEvidence): RightsClassification {
  const license = effectiveLicense(evidence);
  const permissions = licensePermissions[license];
  const rawDataRights = aggregateRawDataRights(evidence);
  let status: RightsStatus = "unknown";
  let reasonCode: RightsReasonCode = "unmatched_evidence";

  if (!hasAuditEvidence(evidence)) {
    reasonCode = "missing_audit_evidence";
  } else if (evidence.evidence_conflict) {
    status = "blocked";
    reasonCode = "conflicting_evidence";
  } else if (evidence.chart_reuse_prohibited === true) {
    status = "blocked";
    reasonCode = "explicit_reuse_prohibition";
  } else if (evidence.embed_available === false && evidence.citation_only_allowed !== true) {
    status = "blocked";
    reasonCode = "official_embed_unavailable";
  } else if (license === "ALL_RIGHTS_RESERVED") {
    status = "blocked";
    reasonCode = "all_rights_reserved";
  } else if (evidence.chart_owner === null) {
    reasonCode = "unknown_chart_owner";
  } else if (!evidence.chart_license_explicit) {
    reasonCode = "chart_license_not_explicit";
  } else if (evidence.chart_owner === "third_party" && !evidence.manual_review_completed) {
    reasonCode = "third_party_review_required";
  } else if (license === "CUSTOM_OR_UNKNOWN") {
    reasonCode = "unknown_chart_license";
  } else if (evidence.embed_available === null) {
    reasonCode = "unknown_embed_capability";
  } else if (permissions.base_status === "restricted") {
    status = "restricted";
    reasonCode = permissions.restricted_reason ?? "unmatched_evidence";
  } else if (rawDataRights === false) {
    status = "restricted";
    reasonCode = "raw_data_non_redistributable";
  } else if (evidence.chart_owner === "owid" && evidence.embed_available === true) {
    status = "safe";
    reasonCode = "verified_permissive_chart";
  } else if (evidence.chart_owner === "third_party" && evidence.manual_review_completed) {
    status = permissions.base_status;
    reasonCode = "manually_verified_third_party";
  }

  const rights = rightsFor(license, evidence, rawDataRights);
  return {
    rights_status: status,
    rights,
    reason_code: reasonCode,
    chart_license: license,
    raw_data_redistribution: rawDataRights,
    actions: actionPermissions(status, rights, evidence),
  };
}
