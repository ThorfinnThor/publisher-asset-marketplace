import { classifyRights, type RightsEvidence } from "./classify-rights";
import type { RightsReasonCode, RightsStatus, SupportedLicense, TriState } from "./contracts";

export type RightsReviewManifestAsset = {
  slug: string;
  canonical_url: string;
  chart_owner: "owid" | "third_party";
  chart_license_code: SupportedLicense;
  chart_license_raw: string;
  chart_license_url: string;
  chart_license_explicit: true;
  manual_review_completed: boolean;
  embed_available: boolean;
  citation_only_allowed: boolean;
  chart_reuse_prohibited: boolean;
  evidence_conflict: boolean;
  evidence_url: string;
  expected_rights_status: RightsStatus;
  expected_raw_data_redistribution: TriState;
  review_note: string;
  citation_text?: string;
  attribution_name?: string;
  attribution_url?: string;
};

export type RightsReviewManifest = {
  review_version: string;
  reviewed_at: string;
  review_scope: string;
  assets: RightsReviewManifestAsset[];
};

export type RightsReviewAssetRow = {
  id: string;
  slug: string;
  canonical_url: string;
  citation_text: string | null;
  attribution_name?: string | null;
  attribution_url?: string | null;
  rights_status: RightsStatus;
  status: "draft" | "review" | "published" | "hidden";
  metadata_json: string | null;
};

export type RightsReviewUpdate = {
  asset_id: string;
  slug: string;
  canonical_url: string;
  license_code: SupportedLicense;
  rights_status: RightsStatus;
  reason_code: RightsReasonCode;
  rights_json: string;
  metadata_json: string;
  citation_text: string | null;
  attribution_name: string | null;
  attribution_url: string | null;
  status: RightsReviewAssetRow["status"];
  updated_at: string;
  review: {
    id: string;
    notes: string;
    evidence_url: string;
    created_at: string;
  };
};

export type RightsReviewPlan = {
  review_version: string;
  reviewed_at: string;
  publish: boolean;
  updates: RightsReviewUpdate[];
  counts: {
    reviewed: number;
    safe: number;
    restricted: number;
    unknown: number;
    blocked: number;
    raw_data_enabled: number;
    raw_data_unverified: number;
  };
};

export type RightsReviewQuery = {
  sql: string;
  params: unknown[];
};

const supportedLicenses = new Set<SupportedLicense>([
  "CC0_1_0",
  "PUBLIC_DOMAIN",
  "CC_BY",
  "CC_BY_SA",
  "CC_BY_ND",
  "CC_BY_NC",
  "CC_BY_NC_SA",
  "CC_BY_NC_ND",
  "EU_COMMISSION_REUSE_2011",
  "ALL_RIGHTS_RESERVED",
  "CUSTOM_OR_UNKNOWN",
]);

const rightsStatuses = new Set<RightsStatus>(["safe", "restricted", "unknown", "blocked"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Rights review field ${key} must be a non-empty string`);
  }
  return value;
}

function requiredBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`Rights review field ${key} must be boolean`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Rights review field ${key} must be a non-empty string when provided`);
  }
  return value.trim();
}

function triState(record: Record<string, unknown>, key: string): TriState {
  const value = record[key];
  if (value !== true && value !== false && value !== null) {
    throw new Error(`Rights review field ${key} must be true, false, or null`);
  }
  return value;
}

function parseManifestAsset(value: unknown): RightsReviewManifestAsset {
  if (!isRecord(value)) {
    throw new Error("Each rights review asset must be an object");
  }
  const slug = requiredString(value, "slug");
  const canonicalUrl = requiredString(value, "canonical_url");
  const evidenceUrl = requiredString(value, "evidence_url");
  const chartOwner = requiredString(value, "chart_owner");
  const licenseCode = requiredString(value, "chart_license_code");
  const expectedStatus = requiredString(value, "expected_rights_status");
  if (chartOwner !== "owid" && chartOwner !== "third_party") {
    throw new Error(`Unsupported chart owner for ${slug}: ${chartOwner}`);
  }
  if (!supportedLicenses.has(licenseCode as SupportedLicense)) {
    throw new Error(`Unsupported chart license for ${slug}: ${licenseCode}`);
  }
  if (!rightsStatuses.has(expectedStatus as RightsStatus)) {
    throw new Error(`Unsupported expected rights status for ${slug}: ${expectedStatus}`);
  }
  if (requiredBoolean(value, "chart_license_explicit") !== true) {
    throw new Error(`The chart license must be explicit for reviewed asset ${slug}`);
  }
  if (canonicalUrl !== evidenceUrl) {
    throw new Error(`Evidence URL must be the asset-specific canonical URL for ${slug}`);
  }
  const embedAvailable = requiredBoolean(value, "embed_available");
  const citationOnlyAllowed =
    value.citation_only_allowed === undefined
      ? false
      : requiredBoolean(value, "citation_only_allowed");
  if (citationOnlyAllowed && embedAvailable) {
    throw new Error(`Citation-only review cannot declare an embed available for ${slug}`);
  }
  const attributionUrl = optionalString(value, "attribution_url");
  if (attributionUrl) {
    const parsed = new URL(attributionUrl);
    if (parsed.protocol !== "https:") {
      throw new Error(`Rights review attribution_url must use HTTPS for ${slug}`);
    }
  }

  return {
    slug,
    canonical_url: canonicalUrl,
    chart_owner: chartOwner,
    chart_license_code: licenseCode as SupportedLicense,
    chart_license_raw: requiredString(value, "chart_license_raw"),
    chart_license_url: requiredString(value, "chart_license_url"),
    chart_license_explicit: true,
    manual_review_completed: requiredBoolean(value, "manual_review_completed"),
    embed_available: embedAvailable,
    citation_only_allowed: citationOnlyAllowed,
    chart_reuse_prohibited: requiredBoolean(value, "chart_reuse_prohibited"),
    evidence_conflict: requiredBoolean(value, "evidence_conflict"),
    evidence_url: evidenceUrl,
    expected_rights_status: expectedStatus as RightsStatus,
    expected_raw_data_redistribution: triState(value, "expected_raw_data_redistribution"),
    review_note: requiredString(value, "review_note"),
    citation_text: optionalString(value, "citation_text"),
    attribution_name: optionalString(value, "attribution_name"),
    attribution_url: attributionUrl,
  };
}

export function parseRightsReviewManifest(value: unknown): RightsReviewManifest {
  if (!isRecord(value) || !Array.isArray(value.assets)) {
    throw new Error("Rights review manifest must be an object with an assets array");
  }
  const reviewVersion = requiredString(value, "review_version");
  const reviewedAt = requiredString(value, "reviewed_at");
  if (Number.isNaN(Date.parse(reviewedAt))) {
    throw new Error("Rights review reviewed_at must be a valid date");
  }
  const assets = value.assets.map(parseManifestAsset);
  if (assets.length === 0) {
    throw new Error("Rights review manifest must contain at least one asset");
  }
  const slugs = new Set<string>();
  for (const asset of assets) {
    if (slugs.has(asset.slug)) {
      throw new Error(`Duplicate rights review slug: ${asset.slug}`);
    }
    slugs.add(asset.slug);
  }
  return {
    review_version: reviewVersion,
    reviewed_at: reviewedAt,
    review_scope: requiredString(value, "review_scope"),
    assets,
  };
}

function parseMetadata(value: string | null, slug: string): Record<string, unknown> {
  if (!value) {
    throw new Error(`Asset ${slug} has no metadata_json`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`Asset ${slug} has malformed metadata_json`);
  }
  if (!isRecord(parsed) || !isRecord(parsed.rights_evidence)) {
    throw new Error(`Asset ${slug} has no structured rights_evidence`);
  }
  return parsed;
}

function reviewId(reviewVersion: string, slug: string): string {
  const normalizedVersion = reviewVersion.replace(/[^a-z0-9_-]+/gi, "_");
  return `rights_review_${normalizedVersion}_${slug}`;
}

function statusCounts(updates: RightsReviewUpdate[]): RightsReviewPlan["counts"] {
  const counts: RightsReviewPlan["counts"] = {
    reviewed: updates.length,
    safe: 0,
    restricted: 0,
    unknown: 0,
    blocked: 0,
    raw_data_enabled: 0,
    raw_data_unverified: 0,
  };
  for (const update of updates) {
    counts[update.rights_status] += 1;
    const rights = JSON.parse(update.rights_json) as { raw_data_redistribution?: TriState };
    if (rights.raw_data_redistribution === true) {
      counts.raw_data_enabled += 1;
    } else {
      counts.raw_data_unverified += 1;
    }
  }
  return counts;
}

export function prepareRightsReview(
  rows: RightsReviewAssetRow[],
  manifest: RightsReviewManifest,
  options: { publish?: boolean } = {},
): RightsReviewPlan {
  const rowBySlug = new Map<string, RightsReviewAssetRow>();
  for (const row of rows) {
    if (rowBySlug.has(row.slug)) {
      throw new Error(`Duplicate database asset slug: ${row.slug}`);
    }
    rowBySlug.set(row.slug, row);
  }

  const updates = manifest.assets.map((review): RightsReviewUpdate => {
    const row = rowBySlug.get(review.slug);
    if (!row) {
      throw new Error(`Reviewed asset is missing from the database: ${review.slug}`);
    }
    if (row.canonical_url !== review.canonical_url) {
      throw new Error(`Canonical URL changed for reviewed asset ${review.slug}`);
    }
    if (row.status === "hidden") {
      throw new Error(`Reviewed asset is hidden and cannot be published: ${review.slug}`);
    }
    const metadata = parseMetadata(row.metadata_json, row.slug);
    const previousEvidence = metadata.rights_evidence as unknown as RightsEvidence;
    if (!Array.isArray(previousEvidence.indicator_evidence)) {
      throw new Error(`Asset ${review.slug} has no indicator rights evidence`);
    }
    const reviewedIndicatorEvidence =
      review.chart_license_code === "EU_COMMISSION_REUSE_2011" && metadata.source === "eurostat"
        ? previousEvidence.indicator_evidence.map((indicator) => ({
            ...indicator,
            non_redistributable: false as const,
            origins:
              indicator.origins.length > 0
                ? indicator.origins.map((origin) => ({
                    ...origin,
                    license_code: review.chart_license_code,
                    license_raw: review.chart_license_raw,
                    license_url: review.chart_license_url,
                  }))
                : [
                    {
                      license_code: review.chart_license_code,
                      license_raw: review.chart_license_raw,
                      license_url: review.chart_license_url,
                    },
                  ],
          }))
        : previousEvidence.indicator_evidence;
    const evidence: RightsEvidence = {
      ...previousEvidence,
      chart_owner: review.chart_owner,
      chart_license_code: review.chart_license_code,
      chart_license_raw: review.chart_license_raw,
      chart_license_url: review.chart_license_url,
      chart_license_explicit: review.chart_license_explicit,
      manual_review_completed: review.manual_review_completed,
      embed_available: review.embed_available,
      citation_only_allowed: review.citation_only_allowed,
      chart_reuse_prohibited: review.chart_reuse_prohibited,
      evidence_conflict: review.evidence_conflict,
      citation_available: Boolean((review.citation_text ?? row.citation_text)?.trim()),
      indicator_evidence: reviewedIndicatorEvidence,
      evidence_url: review.evidence_url,
      evidence_checked_at: manifest.reviewed_at,
    };
    const classification = classifyRights(evidence);
    if (classification.rights_status !== review.expected_rights_status) {
      throw new Error(
        `Rights status mismatch for ${review.slug}: expected ${review.expected_rights_status}, got ${classification.rights_status}`,
      );
    }
    if (classification.raw_data_redistribution !== review.expected_raw_data_redistribution) {
      throw new Error(
        `Raw-data decision mismatch for ${review.slug}: expected ${String(review.expected_raw_data_redistribution)}, got ${String(classification.raw_data_redistribution)}`,
      );
    }
    const publishable =
      classification.rights_status === "safe" || classification.rights_status === "restricted";
    const nextStatus = options.publish && publishable ? "published" : row.status;
    return {
      asset_id: row.id,
      slug: row.slug,
      canonical_url: row.canonical_url,
      license_code: classification.chart_license ?? review.chart_license_code,
      rights_status: classification.rights_status,
      reason_code: classification.reason_code,
      rights_json: JSON.stringify(classification.rights),
      metadata_json: JSON.stringify({ ...metadata, rights_evidence: evidence }),
      citation_text: review.citation_text ?? row.citation_text,
      attribution_name: review.attribution_name ?? row.attribution_name ?? null,
      attribution_url: review.attribution_url ?? row.attribution_url ?? null,
      status: nextStatus,
      updated_at: manifest.reviewed_at,
      review: {
        id: reviewId(manifest.review_version, row.slug),
        notes: `${review.review_note} Raw-data redistribution: ${String(classification.raw_data_redistribution)}. Review version: ${manifest.review_version}.`,
        evidence_url: review.evidence_url,
        created_at: manifest.reviewed_at,
      },
    };
  });

  return {
    review_version: manifest.review_version,
    reviewed_at: manifest.reviewed_at,
    publish: options.publish === true,
    updates,
    counts: statusCounts(updates),
  };
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildRightsReviewSql(plan: RightsReviewPlan): string {
  const statements = plan.updates.flatMap((update) => [
    `UPDATE assets SET license_code = ${sqlLiteral(update.license_code)}, rights_status = ${sqlLiteral(update.rights_status)}, rights_json = ${sqlLiteral(update.rights_json)}, metadata_json = ${sqlLiteral(update.metadata_json)}, citation_text = ${sqlLiteral(update.citation_text)}, attribution_name = ${sqlLiteral(update.attribution_name)}, attribution_url = ${sqlLiteral(update.attribution_url)}, status = ${sqlLiteral(update.status)}, updated_at = ${sqlLiteral(update.updated_at)} WHERE id = ${sqlLiteral(update.asset_id)} AND slug = ${sqlLiteral(update.slug)} AND canonical_url = ${sqlLiteral(update.canonical_url)};`,
    `INSERT OR IGNORE INTO rights_reviews (id, asset_id, decision, reason_code, notes, evidence_url, reviewed_by, created_at) VALUES (${sqlLiteral(update.review.id)}, ${sqlLiteral(update.asset_id)}, ${sqlLiteral(update.rights_status)}, ${sqlLiteral(update.reason_code)}, ${sqlLiteral(update.review.notes)}, ${sqlLiteral(update.review.evidence_url)}, NULL, ${sqlLiteral(update.review.created_at)});`,
  ]);
  return `${statements.join("\n\n")}\n`;
}

export function buildRightsReviewQueries(plan: RightsReviewPlan): RightsReviewQuery[] {
  return plan.updates.flatMap((update) => [
    {
      sql: `UPDATE assets SET license_code = ?, rights_status = ?, rights_json = ?, metadata_json = ?, citation_text = ?, attribution_name = ?, attribution_url = ?, status = ?, updated_at = ? WHERE id = ? AND slug = ? AND canonical_url = ?`,
      params: [
        update.license_code,
        update.rights_status,
        update.rights_json,
        update.metadata_json,
        update.citation_text,
        update.attribution_name,
        update.attribution_url,
        update.status,
        update.updated_at,
        update.asset_id,
        update.slug,
        update.canonical_url,
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO rights_reviews (id, asset_id, decision, reason_code, notes, evidence_url, reviewed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
      params: [
        update.review.id,
        update.asset_id,
        update.rights_status,
        update.reason_code,
        update.review.notes,
        update.review.evidence_url,
        update.review.created_at,
      ],
    },
  ]);
}
