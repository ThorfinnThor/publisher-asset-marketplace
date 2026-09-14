import type { AssetRights, RightsStatus } from "../rights/contracts";

export type AuditStratum = RightsStatus | "missing_metadata" | "stale";

export type AuditAssetRow = {
  id: string;
  slug: string;
  title: string;
  rights_status: RightsStatus;
  status: "draft" | "review" | "published" | "hidden";
  source_updated_at: string | null;
  last_checked_at: string | null;
  metadata_json: string | null;
  rights_json: string | null;
  canonical_url: string;
  embed_url: string | null;
  citation_text: string | null;
};

export type AuditFindingCode =
  | "invalid_metadata_json"
  | "missing_chart_title"
  | "missing_description"
  | "missing_indicators"
  | "missing_source_updated_at"
  | "invalid_rights_json"
  | "missing_rights_evidence"
  | "unverified_chart_evidence"
  | "incomplete_safe_permissions"
  | "restricted_without_restriction"
  | "blocked_embed_allowed"
  | "non_public_rights_published"
  | "stale_source";

export type AuditFinding = {
  asset_id: string;
  slug: string;
  code: AuditFindingCode;
  severity: "info" | "warning" | "error";
  detail: string;
};

export type AuditSample = {
  id: string;
  slug: string;
  rights_status: RightsStatus;
  status: AuditAssetRow["status"];
  source_updated_at: string | null;
  finding_codes: AuditFindingCode[];
};

export type ImportAuditReport = {
  audited_at: string;
  stale_after_days: number;
  sample_per_stratum: number;
  population: {
    total: number;
    by_rights_status: Record<RightsStatus, number>;
  };
  strata: Record<
    AuditStratum,
    {
      population: number;
      sampled: number;
      state: "covered" | "not_present";
      samples: AuditSample[];
    }
  >;
  findings: AuditFinding[];
  gate_b: {
    passed: boolean;
    reasons: string[];
  };
};

export type ImportAuditOptions = {
  audited_at?: string;
  stale_after_days?: number;
  sample_per_stratum?: number;
};

const rightsStatuses: RightsStatus[] = ["safe", "restricted", "unknown", "blocked"];
const strata: AuditStratum[] = [...rightsStatuses, "missing_metadata", "stale"];
const millisecondsPerDay = 24 * 60 * 60 * 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function validDate(value: string | null | undefined): value is string {
  return Boolean(value) && !Number.isNaN(Date.parse(value as string));
}

function asAssetRights(value: Record<string, unknown> | null): AssetRights | null {
  if (!value) {
    return null;
  }
  const triStateKeys: Array<keyof AssetRights> = [
    "embed_allowed",
    "commercial_use",
    "modification_allowed",
    "citation_required",
    "raw_data_redistribution",
    "share_alike",
    "attribution_required",
  ];
  if (
    triStateKeys.some((key) => value[key] !== true && value[key] !== false && value[key] !== null)
  ) {
    return null;
  }
  if (
    (value.evidence_url !== null && typeof value.evidence_url !== "string") ||
    (value.evidence_checked_at !== null && typeof value.evidence_checked_at !== "string")
  ) {
    return null;
  }
  return value as AssetRights;
}

function metadataParts(metadataJson: Record<string, unknown> | null): {
  chartTitle: string | null;
  description: string | null;
  indicatorCount: number;
  nextUpdates: string[];
  evidence: Record<string, unknown> | null;
} {
  const metadata = isRecord(metadataJson?.metadata) ? metadataJson.metadata : null;
  const chart = isRecord(metadata?.chart) ? metadata.chart : null;
  const chartTitle = nonEmptyString(chart?.title) ? chart.title : null;
  const description = nonEmptyString(chart?.subtitle)
    ? chart.subtitle
    : nonEmptyString(chart?.note)
      ? chart.note
      : null;
  const indicators = Array.isArray(metadataJson?.indicators) ? metadataJson.indicators : [];
  const columns = isRecord(metadata?.columns) ? metadata.columns : null;
  const nextUpdates = Object.values(columns ?? {})
    .filter(isRecord)
    .map((column) => column.nextUpdate)
    .filter(nonEmptyString)
    .filter((value) => validDate(value));
  const evidence = isRecord(metadataJson?.rights_evidence) ? metadataJson.rights_evidence : null;
  return { chartTitle, description, indicatorCount: indicators.length, nextUpdates, evidence };
}

function sourceIsStale(
  sourceUpdatedAt: string | null,
  nextUpdates: string[],
  auditedAt: string,
  staleAfterDays: number,
): { stale: boolean; detail: string | null } {
  const auditedTime = Date.parse(auditedAt);
  const validNextUpdates = nextUpdates.map(Date.parse).filter((value) => !Number.isNaN(value));
  if (validNextUpdates.length > 0) {
    const overdue = Math.min(...validNextUpdates) < auditedTime;
    return {
      stale: overdue,
      detail: overdue ? "At least one source nextUpdate date has passed." : null,
    };
  }
  if (!validDate(sourceUpdatedAt)) {
    return { stale: false, detail: null };
  }
  const ageDays = Math.floor((auditedTime - Date.parse(sourceUpdatedAt)) / millisecondsPerDay);
  return {
    stale: ageDays > staleAfterDays,
    detail:
      ageDays > staleAfterDays
        ? `Source data is ${ageDays} days old and has no nextUpdate date.`
        : null,
  };
}

function auditAsset(
  asset: AuditAssetRow,
  auditedAt: string,
  staleAfterDays: number,
): { findings: AuditFinding[]; strata: Set<AuditStratum> } {
  const findings: AuditFinding[] = [];
  const assetStrata = new Set<AuditStratum>([asset.rights_status]);
  const add = (
    code: AuditFindingCode,
    severity: AuditFinding["severity"],
    detail: string,
  ): void => {
    findings.push({ asset_id: asset.id, slug: asset.slug, code, severity, detail });
  };

  const metadataJson = parseRecord(asset.metadata_json);
  const metadata = metadataParts(metadataJson);
  if (!metadataJson) {
    add("invalid_metadata_json", "warning", "metadata_json is missing, invalid, or not an object.");
    assetStrata.add("missing_metadata");
  }
  if (!metadata.chartTitle) {
    add("missing_chart_title", "warning", "Chart-specific title metadata is missing.");
    assetStrata.add("missing_metadata");
  }
  if (!metadata.description) {
    add("missing_description", "warning", "Chart subtitle and note are both missing.");
    assetStrata.add("missing_metadata");
  }
  if (metadata.indicatorCount === 0) {
    add("missing_indicators", "warning", "No indicator metadata was captured.");
    assetStrata.add("missing_metadata");
  }
  if (!validDate(asset.source_updated_at)) {
    add("missing_source_updated_at", "warning", "source_updated_at is missing or invalid.");
    assetStrata.add("missing_metadata");
  }

  const rights = asAssetRights(parseRecord(asset.rights_json));
  if (!rights) {
    add("invalid_rights_json", "error", "rights_json is missing or does not match AssetRights.");
  }
  const evidenceUrl = metadata.evidence?.evidence_url;
  const evidenceCheckedAt = metadata.evidence?.evidence_checked_at;
  const hasEvidence =
    nonEmptyString(evidenceUrl) &&
    validDate(typeof evidenceCheckedAt === "string" ? evidenceCheckedAt : null);
  if (!hasEvidence) {
    add("missing_rights_evidence", "error", "Rights evidence URL or audit date is missing.");
  }

  if (asset.rights_status === "safe" || asset.rights_status === "restricted") {
    const chartOwner = metadata.evidence?.chart_owner;
    const explicitLicense = metadata.evidence?.chart_license_explicit === true;
    if ((chartOwner !== "owid" && chartOwner !== "third_party") || !explicitLicense) {
      add(
        "unverified_chart_evidence",
        "error",
        "A public rights status requires a verified chart owner and explicit chart license.",
      );
    }
  }

  if (
    asset.rights_status === "safe" &&
    rights &&
    (rights.embed_allowed !== true ||
      rights.commercial_use !== true ||
      rights.modification_allowed !== true)
  ) {
    add(
      "incomplete_safe_permissions",
      "error",
      "Safe assets must explicitly allow embedding, commercial use, and modification.",
    );
  }

  if (
    asset.rights_status === "restricted" &&
    rights &&
    rights.commercial_use !== false &&
    rights.modification_allowed !== false &&
    rights.raw_data_redistribution !== false &&
    rights.share_alike !== true
  ) {
    add(
      "restricted_without_restriction",
      "error",
      "Restricted status does not contain an explicit restriction.",
    );
  }

  if (asset.rights_status === "blocked" && rights?.embed_allowed !== false) {
    add("blocked_embed_allowed", "error", "Blocked assets must not allow embed copying.");
  }

  if (
    (asset.rights_status === "unknown" || asset.rights_status === "blocked") &&
    asset.status === "published"
  ) {
    add(
      "non_public_rights_published",
      "error",
      `${asset.rights_status} assets must remain unpublished.`,
    );
  }

  const freshness = sourceIsStale(
    asset.source_updated_at,
    metadata.nextUpdates,
    auditedAt,
    staleAfterDays,
  );
  if (freshness.stale) {
    add("stale_source", "warning", freshness.detail ?? "Source data is stale.");
    assetStrata.add("stale");
  }

  return { findings, strata: assetStrata };
}

function emptyStatusCounts(): Record<RightsStatus, number> {
  return { safe: 0, restricted: 0, unknown: 0, blocked: 0 };
}

export function auditImportAssets(
  assets: AuditAssetRow[],
  options: ImportAuditOptions = {},
): ImportAuditReport {
  const auditedAt = options.audited_at ?? new Date().toISOString();
  const staleAfterDays = options.stale_after_days ?? 730;
  const samplePerStratum = options.sample_per_stratum ?? 3;
  if (!validDate(auditedAt)) {
    throw new Error("audited_at must be a valid date");
  }
  if (!Number.isInteger(staleAfterDays) || staleAfterDays < 1) {
    throw new Error("stale_after_days must be a positive integer");
  }
  if (!Number.isInteger(samplePerStratum) || samplePerStratum < 1) {
    throw new Error("sample_per_stratum must be a positive integer");
  }

  const orderedAssets = [...assets].sort((left, right) => left.slug.localeCompare(right.slug));
  const findings: AuditFinding[] = [];
  const membership = new Map<string, Set<AuditStratum>>();
  for (const asset of orderedAssets) {
    const result = auditAsset(asset, auditedAt, staleAfterDays);
    findings.push(...result.findings);
    membership.set(asset.id, result.strata);
  }

  const byRightsStatus = emptyStatusCounts();
  for (const asset of orderedAssets) {
    byRightsStatus[asset.rights_status] += 1;
  }

  const strataReport = Object.fromEntries(
    strata.map((stratum) => {
      const population = orderedAssets.filter((asset) => membership.get(asset.id)?.has(stratum));
      const samples = population.slice(0, samplePerStratum).map((asset) => ({
        id: asset.id,
        slug: asset.slug,
        rights_status: asset.rights_status,
        status: asset.status,
        source_updated_at: asset.source_updated_at,
        finding_codes: findings
          .filter((finding) => finding.asset_id === asset.id)
          .map((finding) => finding.code),
      }));
      return [
        stratum,
        {
          population: population.length,
          sampled: samples.length,
          state: population.length > 0 ? "covered" : "not_present",
          samples,
        },
      ];
    }),
  ) as ImportAuditReport["strata"];

  const gateReasons: string[] = [];
  if (orderedAssets.length === 0) {
    gateReasons.push("No imported assets were available for audit.");
  }
  const errorCount = findings.filter((finding) => finding.severity === "error").length;
  if (errorCount > 0) {
    gateReasons.push(`${errorCount} rights or publication invariant finding(s) require review.`);
  }

  return {
    audited_at: auditedAt,
    stale_after_days: staleAfterDays,
    sample_per_stratum: samplePerStratum,
    population: { total: orderedAssets.length, by_rights_status: byRightsStatus },
    strata: strataReport,
    findings,
    gate_b: { passed: gateReasons.length === 0, reasons: gateReasons },
  };
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderImportAuditMarkdown(report: ImportAuditReport, sourceLabel: string): string {
  const lines = [
    "# B6 import audit",
    "",
    `- Audit time: ${report.audited_at}`,
    `- Data source: ${sourceLabel}`,
    `- Assets audited: ${report.population.total}`,
    `- Gate B: **${report.gate_b.passed ? "OPEN" : "CLOSED"}**`,
    "",
    "## Stratified coverage",
    "",
    "| Stratum | Population | Sampled | State |",
    "| --- | ---: | ---: | --- |",
    ...strata.map((stratum) => {
      const entry = report.strata[stratum];
      return `| ${stratum} | ${entry.population} | ${entry.sampled} | ${entry.state} |`;
    }),
    "",
    "## Gate B decision",
    "",
  ];

  if (report.gate_b.passed) {
    lines.push(
      "Gate B passed: every live rights status was sampled and no rights invariant failed.",
    );
  } else {
    lines.push(...report.gate_b.reasons.map((reason) => `- ${reason}`));
  }

  lines.push(
    "",
    "## Sample",
    "",
    "| Stratum | Slug | Rights | Publication | Source updated | Findings |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const stratum of strata) {
    for (const sample of report.strata[stratum].samples) {
      lines.push(
        `| ${stratum} | ${escapeCell(sample.slug)} | ${sample.rights_status} | ${sample.status} | ${sample.source_updated_at ?? "missing"} | ${sample.finding_codes.join(", ") || "none"} |`,
      );
    }
  }

  lines.push(
    "",
    "## Findings",
    "",
    "| Severity | Slug | Code | Detail |",
    "| --- | --- | --- | --- |",
  );
  if (report.findings.length === 0) {
    lines.push("| — | — | — | No findings. |");
  } else {
    for (const finding of report.findings) {
      lines.push(
        `| ${finding.severity} | ${escapeCell(finding.slug)} | ${finding.code} | ${escapeCell(finding.detail)} |`,
      );
    }
  }

  lines.push(
    "",
    "## Interpretation",
    "",
    "A closed gate keeps public rights badges disabled. `unknown` and `blocked` assets must remain unpublished. Missing/stale strata are reviewed when present; their absence alone does not fail the gate.",
    "",
  );
  return `${lines.join("\n")}\n`;
}
