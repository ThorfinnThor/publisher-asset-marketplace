import { describe, expect, it } from "vitest";

import {
  classifyRights,
  normalizeSupportedLicense,
  type RightsEvidence,
} from "../src/lib/rights/classify-rights";

const auditEvidence = {
  evidence_url: "https://example.test/chart-license",
  evidence_checked_at: "2026-09-14T00:00:00.000Z",
};

const baseEvidence: RightsEvidence = {
  chart_owner: "owid",
  chart_license_code: null,
  chart_license_raw: "CC BY 4.0",
  chart_license_url: "https://example.test/chart-license",
  chart_license_explicit: true,
  manual_review_completed: false,
  embed_available: true,
  chart_reuse_prohibited: false,
  evidence_conflict: false,
  citation_available: true,
  indicator_evidence: [],
  ...auditEvidence,
};

function classify(overrides: Partial<RightsEvidence> = {}) {
  return classifyRights({ ...baseEvidence, ...overrides });
}

describe("normalizeSupportedLicense", () => {
  it.each([
    ["CC0", "CC0_1_0"],
    ["Public Domain Mark", "PUBLIC_DOMAIN"],
    ["CC BY 3.0 DEED", "CC_BY"],
    ["CC BY-SA 4.0 International", "CC_BY_SA"],
    ["CC BY-ND 4.0", "CC_BY_ND"],
    ["CC BY-NC 4.0", "CC_BY_NC"],
    ["CC BY-NC-SA 4.0", "CC_BY_NC_SA"],
    ["CC BY-NC-ND 4.0", "CC_BY_NC_ND"],
    ["All rights reserved", "ALL_RIGHTS_RESERVED"],
    ["EU_COMMISSION_REUSE_2011", "EU_COMMISSION_REUSE_2011"],
    ["copyright 2001, 2023 named provider", "CUSTOM_OR_UNKNOWN"],
  ] as const)("normalizes only supported exact labels: %s", (raw, expected) => {
    expect(normalizeSupportedLicense(raw)).toBe(expected);
  });
});

describe("classifyRights", () => {
  it("returns safe for an OWID-owned explicit CC BY chart", () => {
    const result = classify();

    expect(result).toMatchObject({
      rights_status: "safe",
      reason_code: "verified_permissive_chart",
      chart_license: "CC_BY",
    });
    expect(result.rights).toMatchObject({
      embed_allowed: true,
      commercial_use: true,
      modification_allowed: true,
      citation_required: true,
      attribution_required: true,
      raw_data_redistribution: null,
    });
    expect(result.actions).toEqual({
      embed_copy: true,
      citation_copy: true,
      source_link: true,
      raw_data_action: false,
    });
  });

  it("marks share-alike charts restricted", () => {
    const result = classify({ chart_license_raw: "CC BY-SA 4.0" });
    expect(result).toMatchObject({
      rights_status: "restricted",
      reason_code: "share_alike_required",
    });
    expect(result.rights.share_alike).toBe(true);
  });

  it("marks non-commercial charts restricted", () => {
    const result = classify({ chart_license_raw: "CC BY-NC 4.0" });
    expect(result).toMatchObject({
      rights_status: "restricted",
      reason_code: "noncommercial_only",
    });
    expect(result.rights.commercial_use).toBe(false);
  });

  it("marks no-derivatives charts restricted", () => {
    const result = classify({ chart_license_raw: "CC BY-ND 4.0" });
    expect(result).toMatchObject({
      rights_status: "restricted",
      reason_code: "no_derivatives",
    });
    expect(result.rights.modification_allowed).toBe(false);
  });

  it("blocks an explicit reuse prohibition", () => {
    const result = classify({ chart_reuse_prohibited: true });
    expect(result).toMatchObject({
      rights_status: "blocked",
      reason_code: "explicit_reuse_prohibition",
    });
    expect(result.actions.embed_copy).toBe(false);
  });

  it("keeps a missing chart license unknown", () => {
    const result = classify({ chart_license_raw: null, chart_license_explicit: false });
    expect(result).toMatchObject({
      rights_status: "unknown",
      reason_code: "chart_license_not_explicit",
    });
  });

  it("keeps missing audit evidence unknown", () => {
    const result = classify({ evidence_url: null });
    expect(result).toMatchObject({
      rights_status: "unknown",
      reason_code: "missing_audit_evidence",
    });
    expect(result.actions.embed_copy).toBe(false);
  });

  it("keeps an unknown owner unknown", () => {
    const result = classify({ chart_owner: null });
    expect(result).toMatchObject({
      rights_status: "unknown",
      reason_code: "unknown_chart_owner",
    });
  });

  it("requires manual review for third-party charts", () => {
    const result = classify({ chart_owner: "third_party" });
    expect(result).toMatchObject({
      rights_status: "unknown",
      reason_code: "third_party_review_required",
    });
  });

  it("allows an explicitly reviewed citation-only third-party dataset", () => {
    const result = classify({
      chart_owner: "third_party",
      manual_review_completed: true,
      embed_available: false,
      citation_only_allowed: true,
    });

    expect(result).toMatchObject({
      rights_status: "safe",
      reason_code: "manually_verified_third_party",
    });
    expect(result.rights.embed_allowed).toBe(false);
    expect(result.actions).toMatchObject({
      embed_copy: false,
      citation_copy: true,
    });
  });

  it("classifies the reviewed Eurostat reuse policy as safe without enabling embeds", () => {
    const result = classify({
      chart_owner: "third_party",
      chart_license_code: "EU_COMMISSION_REUSE_2011",
      chart_license_raw: "Eurostat reuse policy under Commission Decision 2011/833/EU",
      chart_license_explicit: true,
      manual_review_completed: true,
      embed_available: false,
      citation_only_allowed: true,
      indicator_evidence: [
        {
          indicator_url:
            "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tps00001",
          non_redistributable: false,
          origins: [
            {
              license_code: "EU_COMMISSION_REUSE_2011",
              license_raw: "Eurostat reuse policy",
              license_url: "https://ec.europa.eu/eurostat/help/copyright-notice",
            },
          ],
        },
      ],
    });

    expect(result).toMatchObject({
      rights_status: "safe",
      reason_code: "manually_verified_third_party",
      chart_license: "EU_COMMISSION_REUSE_2011",
      raw_data_redistribution: true,
    });
    expect(result.rights).toMatchObject({
      commercial_use: true,
      modification_allowed: true,
      embed_allowed: false,
      citation_required: true,
      attribution_required: true,
    });
  });

  it("allows a transparent automated Eurostat policy gate without pretending it was manual", () => {
    const result = classify({
      chart_owner: "third_party",
      chart_license_code: "EU_COMMISSION_REUSE_2011",
      chart_license_raw: "Eurostat reuse policy under Commission Decision 2011/833/EU",
      chart_license_explicit: true,
      manual_review_completed: false,
      automated_review_completed: true,
      automated_review_version: "eurostat-automated-policy-v1",
      embed_available: false,
      citation_only_allowed: true,
      indicator_evidence: [
        {
          indicator_url: "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/x",
          non_redistributable: false,
          origins: [
            {
              license_code: "EU_COMMISSION_REUSE_2011",
              license_raw: "Eurostat reuse policy",
              license_url: "https://ec.europa.eu/eurostat/help/copyright-notice",
            },
          ],
        },
      ],
    });
    expect(result).toMatchObject({
      rights_status: "safe",
      reason_code: "automated_policy_verified_third_party",
      rights: {
        automated_review_completed: true,
        automated_review_version: "eurostat-automated-policy-v1",
      },
    });
  });

  it("blocks a missing embed unless citation-only use was explicitly reviewed", () => {
    const result = classify({ embed_available: false });
    expect(result).toMatchObject({
      rights_status: "blocked",
      reason_code: "official_embed_unavailable",
    });
  });

  it("blocks conflicting chart evidence", () => {
    const result = classify({ evidence_conflict: true });
    expect(result).toMatchObject({
      rights_status: "blocked",
      reason_code: "conflicting_evidence",
    });
  });

  it("restricts a permissive chart when raw data is non-redistributable", () => {
    const result = classify({
      indicator_evidence: [
        {
          indicator_url: "https://api.example.test/indicator/1",
          non_redistributable: true,
          origins: [{ license_code: "CC_BY", license_raw: "CC BY 4.0", license_url: null }],
        },
      ],
    });
    expect(result).toMatchObject({
      rights_status: "restricted",
      reason_code: "raw_data_non_redistributable",
      raw_data_redistribution: false,
    });
    expect(result.actions.raw_data_action).toBe(false);
  });

  it("keeps unknown origin rights null without downgrading a verified chart", () => {
    const result = classify({
      indicator_evidence: [
        {
          indicator_url: "https://api.example.test/indicator/2",
          non_redistributable: false,
          origins: [
            {
              license_code: null,
              license_raw: "copyright provider terms",
              license_url: "https://example.test/terms",
            },
          ],
        },
      ],
    });
    expect(result.rights_status).toBe("safe");
    expect(result.raw_data_redistribution).toBe(null);
    expect(result.actions.raw_data_action).toBe(false);
  });

  it("allows raw-data action only when every origin is permissive", () => {
    const result = classify({
      indicator_evidence: [
        {
          indicator_url: "https://api.example.test/indicator/3",
          non_redistributable: false,
          origins: [
            { license_code: "CC_BY", license_raw: null, license_url: null },
            { license_code: "PUBLIC_DOMAIN", license_raw: null, license_url: null },
          ],
        },
      ],
    });
    expect(result.raw_data_redistribution).toBe(true);
    expect(result.actions.raw_data_action).toBe(true);
  });

  it("does not infer rights from a custom label containing CC BY", () => {
    const result = classify({ chart_license_raw: "CC BY subject to provider terms" });
    expect(result).toMatchObject({
      rights_status: "unknown",
      chart_license: "CUSTOM_OR_UNKNOWN",
      reason_code: "unknown_chart_license",
    });
  });

  it("never exposes embed copy for a blocked asset", () => {
    const result = classify({ embed_available: true, chart_reuse_prohibited: true });
    expect(result.rights_status).toBe("blocked");
    expect(result.actions.embed_copy).toBe(false);
  });

  it.each([
    ["CC0_1_0", "safe"],
    ["PUBLIC_DOMAIN", "safe"],
    ["CC_BY", "safe"],
    ["CC_BY_SA", "restricted"],
    ["CC_BY_ND", "restricted"],
    ["CC_BY_NC", "restricted"],
    ["CC_BY_NC_SA", "restricted"],
    ["CC_BY_NC_ND", "restricted"],
    ["ALL_RIGHTS_RESERVED", "blocked"],
    ["EU_COMMISSION_REUSE_2011", "safe"],
    ["CUSTOM_OR_UNKNOWN", "unknown"],
  ] as const)("covers the status mapping for %s", (license, status) => {
    const result = classify({
      chart_license_code: license,
      chart_license_raw: null,
      chart_license_explicit: license !== "CUSTOM_OR_UNKNOWN",
    });
    expect(result.rights_status).toBe(status);
  });
});
