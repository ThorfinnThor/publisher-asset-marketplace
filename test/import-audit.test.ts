import { describe, expect, it } from "vitest";

import {
  auditImportAssets,
  renderImportAuditMarkdown,
  type AuditAssetRow,
} from "../src/lib/audit/import-audit";
import type { AssetRights, RightsStatus } from "../src/lib/rights/contracts";

const auditedAt = "2026-09-14T12:00:00.000Z";

function rights(status: RightsStatus): AssetRights {
  return {
    embed_allowed: status !== "blocked",
    commercial_use: status === "restricted" ? false : status === "blocked" ? false : true,
    modification_allowed: status === "blocked" ? false : true,
    citation_required: true,
    raw_data_redistribution: status === "restricted" ? false : true,
    share_alike: false,
    attribution_required: true,
    evidence_url: "https://example.test/evidence",
    evidence_checked_at: auditedAt,
  };
}

function asset(
  slug: string,
  status: RightsStatus,
  overrides: Partial<AuditAssetRow> = {},
): AuditAssetRow {
  return {
    id: `asset_${slug}`,
    slug,
    title: slug,
    rights_status: status,
    status: status === "safe" || status === "restricted" ? "review" : "draft",
    source_updated_at: "2026-08-01",
    last_checked_at: auditedAt,
    metadata_json: JSON.stringify({
      metadata: {
        chart: { title: slug, subtitle: "Description" },
        columns: {
          Value: { nextUpdate: "2027-01-01" },
        },
      },
      indicators: [{ url: "https://example.test/indicator" }],
      rights_evidence: {
        chart_owner: "owid",
        chart_license_explicit: true,
        evidence_url: "https://example.test/evidence",
        evidence_checked_at: auditedAt,
      },
    }),
    rights_json: JSON.stringify(rights(status)),
    canonical_url: `https://example.test/${slug}`,
    embed_url: `https://example.test/${slug}?embed=1`,
    citation_text: "Example citation",
    ...overrides,
  };
}

describe("B6 import audit", () => {
  it("passes a conservative, fully stratified audit", () => {
    const missing = asset("e-missing", "unknown", {
      metadata_json: JSON.stringify({
        metadata: { chart: { title: "Missing description" }, columns: {} },
        indicators: [{ url: "https://example.test/indicator" }],
        rights_evidence: {
          chart_owner: null,
          chart_license_explicit: false,
          evidence_url: "https://example.test/evidence",
          evidence_checked_at: auditedAt,
        },
      }),
    });
    const stale = asset("f-stale", "unknown", {
      source_updated_at: "2022-01-01",
      metadata_json: JSON.stringify({
        metadata: {
          chart: { title: "Stale", subtitle: "Description" },
          columns: {},
        },
        indicators: [{ url: "https://example.test/indicator" }],
        rights_evidence: {
          chart_owner: null,
          chart_license_explicit: false,
          evidence_url: "https://example.test/evidence",
          evidence_checked_at: auditedAt,
        },
      }),
    });
    const report = auditImportAssets(
      [
        asset("a-safe", "safe"),
        asset("b-restricted", "restricted"),
        asset("c-unknown", "unknown"),
        asset("d-blocked", "blocked"),
        missing,
        stale,
      ],
      { audited_at: auditedAt },
    );

    expect(report.gate_b).toEqual({ passed: true, reasons: [] });
    expect(report.strata.missing_metadata.population).toBe(1);
    expect(report.strata.stale.population).toBe(1);
    expect(report.findings.filter((finding) => finding.severity === "error")).toEqual([]);
  });

  it("does not fail Gate B merely because unobserved rights strata are absent", () => {
    const report = auditImportAssets([asset("only-unknown", "unknown")], {
      audited_at: auditedAt,
    });

    expect(report.gate_b).toEqual({ passed: true, reasons: [] });
  });

  it("accepts a reviewed safe citation-only asset without an embed", () => {
    const citationOnly = asset("citation-only", "safe", {
      embed_url: null,
      citation_text: "Reviewed citation",
      rights_json: JSON.stringify({ ...rights("safe"), embed_allowed: false }),
      metadata_json: JSON.stringify({
        metadata: {
          chart: { title: "Citation only", subtitle: "Description" },
          columns: { Value: { nextUpdate: "2027-01-01" } },
        },
        indicators: [{ url: "https://example.test/indicator" }],
        rights_evidence: {
          chart_owner: "third_party",
          chart_license_explicit: true,
          citation_only_allowed: true,
          evidence_url: "https://example.test/evidence",
          evidence_checked_at: auditedAt,
        },
      }),
    });

    expect(auditImportAssets([citationOnly], { audited_at: auditedAt }).gate_b).toEqual({
      passed: true,
      reasons: [],
    });
  });

  it("accepts reviewed creator-attestation evidence without OWID-style license metadata", () => {
    const creator = asset("creator-calculator", "restricted", {
      status: "published",
      metadata_json: JSON.stringify({
        source: "creator_submission",
        submission_id: "submission-1",
        authorization_version: 4,
        reviewed_by: "system:auto-publisher",
        reviewed_at: auditedAt,
        rights_evidence_url: "https://creator.example/terms",
        rights_reason_code: "creator_attested_auto_publish",
      }),
      rights_json: JSON.stringify({
        ...rights("restricted"),
        embed_allowed: true,
        commercial_use: true,
        modification_allowed: false,
        evidence_url: "https://creator.example/terms",
        evidence_checked_at: auditedAt,
      }),
    });

    const report = auditImportAssets([creator], { audited_at: auditedAt });

    expect(report.gate_b).toEqual({ passed: true, reasons: [] });
    expect(report.findings.filter((finding) => finding.severity === "error")).toEqual([]);
  });

  it("fails rights invariants and quarantines malformed metadata for review", () => {
    const report = auditImportAssets(
      [
        asset("unsafe-publication", "unknown", {
          status: "published",
          metadata_json: "not-json",
          rights_json: "{}",
        }),
      ],
      { audited_at: auditedAt },
    );

    expect(report.strata.missing_metadata.population).toBe(1);
    expect(report.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "invalid_metadata_json",
        "invalid_rights_json",
        "missing_rights_evidence",
        "non_public_rights_published",
      ]),
    );
    expect(report.gate_b.reasons.at(-1)).toMatch(/invariant finding/);
  });

  it("uses nextUpdate before the age fallback and samples deterministically", () => {
    const oldButScheduled = asset("z-old-but-scheduled", "unknown", {
      source_updated_at: "2023-01-01",
    });
    const first = asset("a-first", "unknown");
    const report = auditImportAssets([oldButScheduled, first], {
      audited_at: auditedAt,
      sample_per_stratum: 1,
    });

    expect(report.strata.stale.population).toBe(0);
    expect(report.strata.unknown.samples[0]?.slug).toBe("a-first");
    expect(renderImportAuditMarkdown(report, "test D1")).toContain("Gate B: **OPEN**");
  });
});
