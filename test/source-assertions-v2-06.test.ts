import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import eurostatFixtureJson from "../data/seo/source-assertions-v2-06/eurostat-nrg_ind_ren.json";
import fossilFixtureJson from "../data/seo/source-assertions-v2-06/years-of-fossil-fuel-reserves-left.json";
import solarFixtureJson from "../data/seo/source-assertions-v2-06/solar-pv-prices.json";
import reviewJson from "../data/seo/pilot-brief-review-v2-04-sol.json";
import {
  configuredAssetEditorialOverlays,
  type AssetEditorialOverlay,
} from "../src/lib/assets/editorial/asset-editorial-overlay";
import {
  formatPercent,
  percentageDecrease,
  SourceAssertionFixtureSchema,
  type SourceAssertionFixture,
} from "../src/lib/assets/editorial/source-assertion-fixture";

const fixtures = [fossilFixtureJson, solarFixtureJson, eurostatFixtureJson].map((input) =>
  SourceAssertionFixtureSchema.parse(input),
);

const fixtureBySlug = new Map(fixtures.map((fixture) => [fixture.asset_slug, fixture]));
const overlayBySlug = new Map(
  configuredAssetEditorialOverlays().map((overlay) => [overlay.asset_slug, overlay]),
);

describe("V2-06 reproducible source assertions", () => {
  it("parses three unique, rights-aware pilot fixtures", () => {
    expect(fixtures).toHaveLength(3);
    expect(new Set(fixtures.map((fixture) => fixture.asset_id)).size).toBe(3);
    expect(fixture("years-of-fossil-fuel-reserves-left").rights_boundary).toEqual({
      raw_data_redistribution: "not_approved",
      repository_payload: "minimal_reviewed_assertions_only",
    });
    expect(fixture("solar-pv-prices").rights_boundary).toEqual({
      raw_data_redistribution: "not_approved",
      repository_payload: "minimal_reviewed_assertions_only",
    });
    expect(fixture("eurostat-nrg_ind_ren").rights_boundary).toEqual({
      raw_data_redistribution: "allowed_with_attribution_and_policy_exceptions",
      repository_payload: "approved_repository_snapshot",
    });
  });

  it("ties every fixture to its approved overlay version and evidence hashes", () => {
    for (const sourceFixture of fixtures) {
      const overlay = requiredOverlay(sourceFixture.asset_slug);
      expect(sourceFixture.asset_id).toBe(overlay.asset_id);
      expect(Date.parse(sourceFixture.source_updated_at)).toBe(
        Date.parse(overlay.source_contract.expected_source_updated_at),
      );
      for (const sourceFile of sourceFixture.source_files) {
        expect(overlay.source_contract.evidence_sha256).toContain(sourceFile.sha256);
      }
    }
  });

  it("matches the re-fetched OWID file hashes recorded by the Sol review", () => {
    const reviewedRequests = new Map(
      reviewJson.source_retrieval.requests.map((request) => [request.url, request.sha256]),
    );

    for (const slug of ["years-of-fossil-fuel-reserves-left", "solar-pv-prices"] as const) {
      const sourceFixture = fixture(slug);
      expect(sourceFixture.source_schema.format).toBe("csv");
      for (const sourceFile of sourceFixture.source_files) {
        expect(sourceFile.storage).toBe("hash_only_due_rights");
        expect(reviewedRequests.get(sourceFile.url)).toBe(sourceFile.sha256);
      }
    }
  });

  it("locks the fossil-fuel values before display rounding and the asymmetric time coverage", () => {
    const sourceFixture = fixture("years-of-fossil-fuel-reserves-left");
    expect(sourceFixture.source_schema.signature).toEqual([
      "Entity",
      "Code",
      "Year",
      "Gas",
      "Coal",
      "Oil",
    ]);
    expect(sourceFixture.scope).toMatchObject({
      entity_code: "OWID_WRL",
      unit: "years",
      approved_start_year: 1980,
      approved_end_year: 2020,
    });

    expect(assertedValue(sourceFixture, "gas", 2020)).toBe(48.503418);
    expect(assertedValue(sourceFixture, "coal", 2020)).toBe(140.34598);
    expect(assertedValue(sourceFixture, "oil", 2020)).toBe(56.391872);
    expect(series(sourceFixture, "coal")).toMatchObject({
      first_year: 2020,
      last_year: 2020,
      observation_count: 1,
      asserted_missing_years: [2019],
    });
    expect(Number(assertedValue(sourceFixture, "gas", 2020).toFixed(1))).toBe(48.5);
    expect(Number(assertedValue(sourceFixture, "coal", 2020).toFixed(1))).toBe(140.3);
    expect(Number(assertedValue(sourceFixture, "oil", 2020).toFixed(1))).toBe(56.4);
  });

  it("recalculates the solar decline from the locked unrounded endpoints", () => {
    const sourceFixture = fixture("solar-pv-prices");
    expect(sourceFixture.source_schema.signature).toEqual([
      "Entity",
      "Code",
      "Year",
      "Solar PV module cost",
    ]);
    expect(sourceFixture.scope).toMatchObject({
      unit: "constant 2025 US dollars per watt",
      approved_start_year: 1975,
      approved_end_year: 2024,
    });
    expect(series(sourceFixture, "solar-pv-module-price")).toMatchObject({
      observation_count: 50,
      asserted_missing_years: [1974, 2025],
    });

    const start = assertedValue(sourceFixture, "solar-pv-module-price", 1975);
    const end = assertedValue(sourceFixture, "solar-pv-module-price", 2024);
    const assertion = sourceFixture.derived_assertions?.[0];
    if (!assertion) throw new Error("missing solar derived assertion");
    const decline = percentageDecrease(start, end);

    expect(start).toBe(132.3757);
    expect(end).toBe(0.26518628);
    expect(decline).toBeCloseTo(assertion.expected_unrounded, 12);
    expect(formatPercent(decline, assertion.display_decimals)).toBe(assertion.expected_display);
    expect(requiredOverlay(sourceFixture.asset_slug).direct_answer).toContain("about 99.8%");
  });

  it("verifies the Eurostat repository snapshot, JSON-stat schema and 2024 values", () => {
    const sourceFixture = fixture("eurostat-nrg_ind_ren");
    const sourceFile = sourceFixture.source_files[0];
    if (!sourceFile?.snapshot_path) throw new Error("missing Eurostat repository snapshot path");
    const snapshotPath = resolve(sourceFile.snapshot_path);
    const bytes = readFileSync(snapshotPath);
    const snapshot = parseJsonStat(bytes.toString("utf8"));

    expect(createHash("sha256").update(bytes).digest("hex")).toBe(sourceFile.sha256);
    expect(snapshot.id.map((id, index) => `${id}:${snapshot.size[index]}`)).toEqual(
      sourceFixture.source_schema.signature,
    );
    expect(snapshot.updated).toBe(sourceFixture.source_updated_at);
    expect(jsonStatValue(snapshot, "REN", "2024")).toBe(25.241);
    expect(jsonStatValue(snapshot, "REN_TRA", "2024")).toBe(11.2);
    expect(jsonStatValue(snapshot, "REN_ELC", "2024")).toBe(47.503);
    expect(jsonStatValue(snapshot, "REN_HEAT_CL", "2024")).toBe(26.738);

    for (const item of sourceFixture.series) {
      expect(jsonStatValue(snapshot, item.id, "2024")).toBe(
        assertedValue(sourceFixture, item.id, 2024),
      );
    }
  });

  it("keeps provisional and missing Eurostat 2025 observations outside the approved boundary", () => {
    const sourceFixture = fixture("eurostat-nrg_ind_ren");
    const sourceFile = sourceFixture.source_files[0];
    if (!sourceFile?.snapshot_path) throw new Error("missing Eurostat repository snapshot path");
    const snapshot = parseJsonStat(readFileSync(resolve(sourceFile.snapshot_path), "utf8"));

    expect(sourceFixture.scope.approved_end_year).toBe(2024);
    expect(jsonStatValue(snapshot, "REN_TRA", "2025")).toBeUndefined();
    expect(series(sourceFixture, "REN_TRA").asserted_missing_years).toContain(2025);
    for (const excluded of sourceFixture.excluded_observations ?? []) {
      expect(jsonStatValue(snapshot, excluded.series_id, String(excluded.year))).toBe(
        excluded.value,
      );
      expect(jsonStatStatus(snapshot, excluded.series_id, String(excluded.year))).toBe("p");
    }
  });

  it("fails validation when source schema or rights-storage boundaries are corrupted", () => {
    const missingSchema = structuredClone(solarFixtureJson) as Record<string, unknown>;
    missingSchema.source_schema = { format: "csv", signature: [] };
    expect(SourceAssertionFixtureSchema.safeParse(missingSchema).success).toBe(false);

    const redistributed = structuredClone(solarFixtureJson) as Record<string, unknown>;
    redistributed.source_files = [
      {
        kind: "data",
        url: "https://example.com/source.csv",
        sha256: "a".repeat(64),
        storage: "repository_snapshot",
        snapshot_path: "data/editorial/source-snapshots/example/source.csv",
      },
    ];
    expect(SourceAssertionFixtureSchema.safeParse(redistributed).success).toBe(false);
  });

  it("retains the source-specific preview and embed distinctions", () => {
    expect(fixture("years-of-fossil-fuel-reserves-left").presentation_contract).toEqual({
      preview: "source_hosted_chart",
      embed: "source_hosted",
      source_match: "source_updated_at_and_source_file_hashes",
    });
    expect(fixture("solar-pv-prices").presentation_contract).toEqual({
      preview: "source_hosted_chart",
      embed: "source_hosted",
      source_match: "source_updated_at_and_source_file_hashes",
    });
    expect(fixture("eurostat-nrg_ind_ren").presentation_contract).toEqual({
      preview: "d1_imported_source_table",
      embed: "marketplace_rendered",
      source_match: "source_updated_at_and_repository_snapshot_hash",
    });
  });
});

function fixture(slug: string): SourceAssertionFixture {
  const value = fixtureBySlug.get(slug);
  if (!value) throw new Error(`missing source assertion fixture: ${slug}`);
  return value;
}

function requiredOverlay(slug: string): AssetEditorialOverlay {
  const value = overlayBySlug.get(slug);
  if (!value) throw new Error(`missing asset editorial overlay: ${slug}`);
  return value;
}

function series(sourceFixture: SourceAssertionFixture, id: string) {
  const value = sourceFixture.series.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`missing series assertion: ${sourceFixture.asset_slug}/${id}`);
  return value;
}

function assertedValue(sourceFixture: SourceAssertionFixture, id: string, year: number): number {
  const value = series(sourceFixture, id).asserted_values.find(
    (candidate) => candidate.year === year,
  )?.value;
  if (value === undefined) {
    throw new Error(`missing value assertion: ${sourceFixture.asset_slug}/${id}/${year}`);
  }
  return value;
}

type JsonStatSnapshot = {
  updated: string;
  id: string[];
  size: number[];
  dimension: Record<string, { category: { index: Record<string, number> } }>;
  value: Record<string, number>;
  status: Record<string, string>;
};

function parseJsonStat(input: string): JsonStatSnapshot {
  const parsed = JSON.parse(input) as Partial<JsonStatSnapshot>;
  if (
    typeof parsed.updated !== "string" ||
    !Array.isArray(parsed.id) ||
    !Array.isArray(parsed.size) ||
    !parsed.dimension ||
    !parsed.value ||
    !parsed.status
  ) {
    throw new Error("invalid Eurostat JSON-stat fixture");
  }
  return parsed as JsonStatSnapshot;
}

function jsonStatValue(
  snapshot: JsonStatSnapshot,
  seriesId: string,
  year: string,
): number | undefined {
  return snapshot.value[jsonStatIndex(snapshot, { nrg_bal: seriesId, time: year })];
}

function jsonStatStatus(
  snapshot: JsonStatSnapshot,
  seriesId: string,
  year: string,
): string | undefined {
  return snapshot.status[jsonStatIndex(snapshot, { nrg_bal: seriesId, time: year })];
}

function jsonStatIndex(
  snapshot: JsonStatSnapshot,
  selected: { nrg_bal: string; time: string },
): string {
  let index = 0;
  for (let position = 0; position < snapshot.id.length; position += 1) {
    const dimensionId = snapshot.id[position];
    const dimensionSize = snapshot.size[position];
    if (!dimensionId || !dimensionSize) throw new Error("invalid JSON-stat dimension shape");
    const category =
      dimensionId === "nrg_bal"
        ? selected.nrg_bal
        : dimensionId === "time"
          ? selected.time
          : Object.keys(snapshot.dimension[dimensionId]?.category.index ?? {})[0];
    const categoryIndex = category
      ? snapshot.dimension[dimensionId]?.category.index[category]
      : undefined;
    if (categoryIndex === undefined) return "missing";
    index = index * dimensionSize + categoryIndex;
  }
  return String(index);
}
