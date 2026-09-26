import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildEditorialAnalyses,
  type AnalysisDecisionFile,
  type GeographyOverrides,
  type GeographyReference,
} from "../src/lib/editorial/analysis";
import type { EditorialFactPack } from "../src/lib/editorial/fact-pack-schema";

const json = <T>(relativePath: string): T => JSON.parse(readFileSync(relativePath, "utf8")) as T;

const decisions = json<AnalysisDecisionFile>("data/editorial/analysis-decisions.json");
const reference = json<GeographyReference>("data/editorial/reference/un-m49-country-areas.json");
const overrides = json<GeographyOverrides>(
  "data/editorial/reference/cb-001-geography-overrides.json",
);
const originalPacks = Object.fromEntries(
  [
    "cb-001-internet-adoption-gap",
    "cb-002-eu-renewable-share-patterns",
    "cb-003-hicp-inflation-explainer",
    "cb-004-wildfire-land-cover",
  ].map((id) => [id, json<EditorialFactPack>(`data/editorial/fact-packs/${id}.json`)]),
);
const sourceHashes = Object.fromEntries(
  Object.keys(originalPacks).map((id) => [id, "a".repeat(64)]),
);

function run(
  factPacks = structuredClone(originalPacks),
  changedDecisions = structuredClone(decisions),
) {
  return buildEditorialAnalyses({
    factPacks,
    decisions: changedDecisions,
    decisionFileSha256: "b".repeat(64),
    reference,
    overrides,
    packSha256ById: sourceHashes,
  });
}

const analysis = (result: ReturnType<typeof run>, id: string) => {
  const found = result.analyses.find((entry) => entry.brief_id === id);
  if (!found) throw new Error(`missing_test_analysis:${id}`);
  return found;
};

describe("Step 8 editorial calculations", () => {
  it("fails closed if the reviewed decision coverage is incomplete or duplicated", () => {
    const incomplete = structuredClone(decisions);
    incomplete.decisions.pop();
    expect(() => run(structuredClone(originalPacks), incomplete)).toThrow(
      "analysis_decision_coverage_mismatch",
    );

    const duplicated = structuredClone(decisions);
    duplicated.decisions.push(structuredClone(duplicated.decisions[0]!));
    expect(() => run(structuredClone(originalPacks), duplicated)).toThrow(
      "analysis_decision_coverage_mismatch",
    );
  });

  it("classifies every internet entity and meets the paired M49 cohort gate", () => {
    const result = run();
    const internet = analysis(result, "cb-001-internet-adoption-gap");

    expect(internet.status).toBe("calculated_for_sol_review");
    expect(internet.coverage?.classification_counts).toEqual({
      m49_country_or_area: 212,
      aggregate: 12,
      unresolved: 1,
    });
    expect(internet.coverage?.paired_entity_count).toBe(175);
    expect(internet.coverage?.gate_passed).toBe(true);
    expect(internet.coverage?.excluded_unresolved_codes).toEqual(["OWID_KOS"]);
    expect(internet.metrics).toHaveLength(178);
    expect(internet.metrics.every((metric) => metric.input_fact_ids.length > 0)).toBe(true);
    expect(
      internet.metrics.filter((metric) => metric.metric_id.startsWith("internet-change:")),
    ).toHaveLength(175);
    expect(internet.metrics.map((metric) => metric.metric_id)).not.toContain(
      "internet-change:OWID_WRL:2000-2024",
    );
  });

  it("holds internet analysis when fewer than 150 paired M49 entities remain", () => {
    const packs = structuredClone(originalPacks);
    const internet = packs["cb-001-internet-adoption-gap"]!;
    const startCodes = new Set(
      internet.facts.filter((fact) => fact.period === "2000").map((fact) => fact.geography.code),
    );
    const entities = new Set(
      internet.facts
        .filter(
          (fact) =>
            fact.period === "2024" &&
            startCodes.has(fact.geography.code) &&
            reference.entries.some((entry) => entry.alpha3 === fact.geography.code),
        )
        .slice(0, 26)
        .map((fact) => fact.geography.code),
    );
    internet.facts = internet.facts.filter(
      (fact) => !(fact.period === "2024" && entities.has(fact.geography.code)),
    );

    const result = run(packs);
    const held = analysis(result, "cb-001-internet-adoption-gap");
    expect(held.status).toBe("held");
    expect(held.coverage?.paired_entity_count).toBe(149);
    expect(held.metrics).toEqual([]);
  });

  it("fails closed on an unclassified source geography or mismatched aggregate label", () => {
    const packs = structuredClone(originalPacks);
    packs["cb-001-internet-adoption-gap"]!.facts[0]!.geography.code = "NEW_ENTITY";
    expect(() => run(packs)).toThrow("geography_not_classified:NEW_ENTITY");

    const changedOverrides = structuredClone(overrides);
    changedOverrides.aggregates[0]!.name = "Incorrect label";
    expect(() =>
      buildEditorialAnalyses({
        factPacks: structuredClone(originalPacks),
        decisions,
        decisionFileSha256: "b".repeat(64),
        reference,
        overrides: changedOverrides,
        packSha256ById: sourceHashes,
      }),
    ).toThrow("aggregate_name_mismatch:WB_EAP");
  });

  it("rejects changed internet observations and unsupported reuse rights", () => {
    const flagged = structuredClone(originalPacks);
    flagged["cb-001-internet-adoption-gap"]!.facts[0]!.status_quality_flag = "provisional";
    expect(() => run(flagged)).toThrow("internet_value_or_status_invalid");

    const outOfRange = structuredClone(originalPacks);
    outOfRange["cb-001-internet-adoption-gap"]!.facts[0]!.value = 101;
    expect(() => run(outOfRange)).toThrow("internet_value_or_status_invalid");

    const wrongDimension = structuredClone(originalPacks);
    wrongDimension["cb-001-internet-adoption-gap"]!.facts[0]!.dimensions.entity_code = "OTHER";
    expect(() => run(wrongDimension)).toThrow("internet_dimension_or_unit_mismatch");

    const revoked = structuredClone(originalPacks);
    revoked["cb-001-internet-adoption-gap"]!.input_assets[0]!.raw_data_redistribution =
      "Not allowed";
    expect(() => run(revoked)).toThrow("editorial_rights_precondition_failed");
  });

  it("rejects duplicate source fact IDs before producing metrics", () => {
    const packs = structuredClone(originalPacks);
    packs["cb-003-hicp-inflation-explainer"]!.facts[1]!.fact_id =
      packs["cb-003-hicp-inflation-explainer"]!.facts[0]!.fact_id;
    expect(() => run(packs)).toThrow("duplicate_source_fact_id");
  });

  it("calculates renewable 2024 observations and within-category 2021–2024 changes only", () => {
    const renewable = analysis(run(), "cb-002-eu-renewable-share-patterns");
    expect(renewable.status).toBe("calculated_for_sol_review");
    expect(renewable.metrics).toHaveLength(8);
    const totalChange = renewable.metrics.find(
      (metric) => metric.metric_id === "renewable-change:2021-2024:REN",
    );
    expect(totalChange?.value).toBeCloseTo(3.344, 12);
    expect(totalChange?.display).toEqual({ value: 3.3, unit: "percentage points", precision: 1 });
    expect(totalChange?.dimensions).toMatchObject({ from: "2021", to: "2024", category: "REN" });
    const renewableFacts = originalPacks["cb-002-eu-renewable-share-patterns"]!.facts;
    expect(totalChange?.input_fact_ids).toEqual([
      renewableFacts.find((fact) => fact.period === "2021" && fact.dimensions.nrg_bal === "REN")!
        .fact_id,
      renewableFacts.find((fact) => fact.period === "2024" && fact.dimensions.nrg_bal === "REN")!
        .fact_id,
    ]);
    expect(renewable.caveats.join(" ")).toContain("distinct denominators");
  });

  it("rejects an unreviewed Eurostat status flag and altered dimension", () => {
    const flagged = structuredClone(originalPacks);
    const target = flagged["cb-002-eu-renewable-share-patterns"]!.facts.find(
      (fact) => fact.period === "2024" && fact.dimensions.nrg_bal === "REN",
    )!;
    target.status_quality_flag = "p";
    expect(() => run(flagged)).toThrow("renewable_REN_2024:unreviewed_status_p");

    const wrongGeo = structuredClone(originalPacks);
    wrongGeo["cb-002-eu-renewable-share-patterns"]!.facts.find(
      (fact) => fact.period === "2024" && fact.dimensions.nrg_bal === "REN",
    )!.dimensions.geo = "DE";
    expect(() => run(wrongGeo)).toThrow("renewable_pack_scope_drift");
  });

  it("keeps HICP as annual-average rates and computes only the labelled rate difference", () => {
    const hicp = analysis(run(), "cb-003-hicp-inflation-explainer");
    const delta = hicp.metrics.find((metric) => metric.metric_id === "hicp-rate-change:2024-2025");
    expect(hicp.metrics).toHaveLength(9);
    expect(delta?.value).toBeCloseTo(-0.1, 12);
    expect(delta?.display).toEqual({ value: -0.1, unit: "percentage points", precision: 1 });
    const hicpFacts = originalPacks["cb-003-hicp-inflation-explainer"]!.facts;
    expect(delta?.input_fact_ids).toEqual([
      hicpFacts.find((fact) => fact.period === "2024")!.fact_id,
      hicpFacts.find((fact) => fact.period === "2025")!.fact_id,
    ]);
    expect(hicp.caveats.join(" ")).toContain("not index levels");
  });

  it("calculates wildfire World series from complete five-year means with fact lineage", () => {
    const wildfire = analysis(run(), "cb-004-wildfire-land-cover");
    expect(wildfire.metrics).toHaveLength(16);
    const forestMean = wildfire.metrics.find(
      (metric) => metric.metric_id === "wildfire-mean:forest:early_2002_2006",
    );
    const forestDelta = wildfire.metrics.find(
      (metric) => metric.metric_id === "wildfire-mean-difference:forest:early-v-recent",
    );
    expect(forestMean?.input_fact_ids).toHaveLength(5);
    expect(forestMean?.display.unit).toBe("million hectares");
    expect(forestMean?.display.precision).toBe(1);
    expect(forestDelta?.input_fact_ids).toHaveLength(10);
    expect(forestDelta?.value).toBeLessThan(0);
  });

  it("rejects a missing wildfire observation and a zero early-window denominator", () => {
    const missing = structuredClone(originalPacks);
    missing["cb-004-wildfire-land-cover"]!.facts = missing[
      "cb-004-wildfire-land-cover"
    ]!.facts.filter(
      (fact) =>
        !(
          fact.geography.code === "OWID_WRL" &&
          fact.period === "2002" &&
          fact.dimensions.series === "forest"
        ),
    );
    expect(() => run(missing)).toThrow("wildfire_forest_2002:0");

    const zero = structuredClone(originalPacks);
    for (const fact of zero["cb-004-wildfire-land-cover"]!.facts) {
      if (
        fact.geography.code === "OWID_WRL" &&
        ["2002", "2003", "2004", "2005", "2006"].includes(fact.period) &&
        fact.dimensions.series === "forest"
      )
        fact.value = 0;
    }
    expect(() => run(zero)).toThrow("wildfire_relative_change_denominator_not_positive:forest");

    const negative = structuredClone(originalPacks);
    negative["cb-004-wildfire-land-cover"]!.facts.find(
      (fact) =>
        fact.geography.code === "OWID_WRL" &&
        fact.period === "2002" &&
        fact.dimensions.series === "forest",
    )!.value = -1;
    expect(() => run(negative)).toThrow("wildfire_negative_area:forest:early_2002_2006");
  });

  it("keeps the creator guide held and does not emit a metric", () => {
    const creator = analysis(run(), "cb-005-embedding-reviewed-calculators");
    expect(creator.status).toBe("held");
    expect(creator.metrics).toEqual([]);
  });
});
