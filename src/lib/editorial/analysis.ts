import { createHash } from "node:crypto";

import type { EditorialFactPack } from "./fact-pack-schema";

export interface GeographyReferenceEntry {
  name: string;
  m49: string;
  alpha2: string;
  alpha3: string;
}

export interface GeographyReference {
  schema_version: string;
  reference_id: string;
  version: string;
  retrieved_at: string;
  source_url: string;
  response_sha256: string;
  entry_count: number;
  entries_sha256: string;
  entries: GeographyReferenceEntry[];
}

export interface GeographyOverrides {
  aggregates: Array<{ code: string; name: string }>;
  unresolved: Array<{ code: string; name: string }>;
}

export interface AnalysisDecision {
  brief_id: string;
  brief_revision: string;
  decision: string;
}

export interface AnalysisDecisionFile {
  schema_version: string;
  step: number;
  status: string;
  decisions: AnalysisDecision[];
}

export interface AnalysisMetric {
  metric_id: string;
  label: string;
  value: number;
  unit: string;
  formula: {
    name: string;
    version: string;
    expression: string;
  };
  input_fact_ids: string[];
  dimensions: Record<string, string>;
  display: { value: number; unit: string; precision: number };
}

export interface EditorialAnalysisOutput {
  schema_version: "1.0.0";
  step: 8;
  publication_effect: "none";
  decision_file_sha256: string;
  country_reference: {
    id: string;
    version: string;
    source_url: string;
    response_sha256: string;
    entries_sha256: string;
    entry_count: number;
  };
  analyses: Array<{
    brief_id: string;
    brief_revision: string;
    status: "calculated_for_sol_review" | "held";
    source_fact_pack_sha256: string;
    source_snapshot_hashes: Array<{ url: string; sha256: string }>;
    metrics: AnalysisMetric[];
    coverage?: {
      classification_counts: Record<string, number>;
      entities: Array<{
        code: string;
        source_name: string;
        classification: "m49_country_or_area" | "aggregate" | "unresolved";
        reference_name: string | null;
        m49_code: string | null;
      }>;
      paired_entity_count: number;
      required_minimum: number;
      gate_passed: boolean;
      excluded_unresolved_codes: string[];
    };
    caveats: string[];
  }>;
}

const EXPECTED_BRIEF_DECISIONS = new Map([
  ["cb-001-internet-adoption-gap", "conditional_analysis"],
  ["cb-002-eu-renewable-share-patterns", "approved_for_scoped_calculation"],
  ["cb-003-hicp-inflation-explainer", "approved_for_scoped_calculation"],
  ["cb-004-wildfire-land-cover", "approved_for_world_only_calculation"],
  ["cb-005-embedding-reviewed-calculators", "hold_manual_verification"],
]);

const RENEWABLE_CATEGORIES: Record<string, string> = {
  REN: "Overall renewable energy share",
  REN_ELC: "Renewable share in electricity",
  REN_TRA: "Renewable share in transport",
  REN_HEAT_CL: "Renewable share in heating and cooling",
};

const WILDFIRE_CATEGORIES: Record<string, string> = {
  forest: "Forest",
  savannas: "Savannas",
  shrublands_grasslands: "Shrublands and grasslands",
  croplands: "Croplands",
};

export function canonicalJsonSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requireUniqueFact(
  facts: EditorialFactPack["facts"],
  predicate: (fact: EditorialFactPack["facts"][number]) => boolean,
  errorCode: string,
) {
  const matched = facts.filter(predicate);
  if (matched.length !== 1) throw new Error(`${errorCode}:${matched.length}`);
  const fact = matched[0];
  if (!fact || fact.value === null || fact.missing_value) throw new Error(`${errorCode}:missing`);
  if (
    fact.status_quality_flag !== "observed_no_status_flag" &&
    fact.status_quality_flag !== "observed_raw_source_value"
  ) {
    throw new Error(`${errorCode}:unreviewed_status_${fact.status_quality_flag}`);
  }
  return fact;
}

function metric(args: {
  id: string;
  label: string;
  value: number;
  unit: string;
  formulaName: string;
  formulaVersion: string;
  expression: string;
  inputFacts: Array<{ fact_id: string; value: number | null }>;
  dimensions: Record<string, string>;
  displayUnit?: string;
  displayScale?: number;
  precision: number;
}): AnalysisMetric {
  if (!Number.isFinite(args.value)) throw new Error(`non_finite_metric:${args.id}`);
  const displayScale = args.displayScale ?? 1;
  const stableValue = Number(args.value.toPrecision(15));
  const displayValue = stableValue / displayScale;
  const factor = 10 ** args.precision;
  return {
    metric_id: args.id,
    label: args.label,
    value: stableValue,
    unit: args.unit,
    formula: {
      name: args.formulaName,
      version: args.formulaVersion,
      expression: args.expression,
    },
    input_fact_ids: args.inputFacts.map((fact) => fact.fact_id),
    dimensions: args.dimensions,
    display: {
      value: Math.round((displayValue + Number.EPSILON) * factor) / factor,
      unit: args.displayUnit ?? args.unit,
      precision: args.precision,
    },
  };
}

function assertPack(pack: EditorialFactPack, decision: AnalysisDecision) {
  if (pack.id !== decision.brief_id) throw new Error(`pack_id_mismatch:${decision.brief_id}`);
  if (pack.status !== "ready_for_sol_review") throw new Error(`pack_not_ready:${pack.id}`);
  if (pack.brief_revision !== decision.brief_revision) {
    throw new Error(`brief_revision_mismatch:${pack.id}`);
  }
  const expected = EXPECTED_BRIEF_DECISIONS.get(pack.id);
  if (expected !== decision.decision) throw new Error(`decision_mismatch:${pack.id}`);
  if (
    pack.input_assets.some(
      (asset) =>
        asset.commercial_use !== "Allowed" ||
        asset.modification_allowed !== "Allowed" ||
        asset.raw_data_redistribution !== "Allowed" ||
        !asset.attribution_required,
    )
  ) {
    throw new Error(`editorial_rights_precondition_failed:${pack.id}`);
  }
  const factIds = pack.facts.map((fact) => fact.fact_id);
  if (new Set(factIds).size !== factIds.length) {
    throw new Error(`duplicate_source_fact_id:${pack.id}`);
  }
}

function assertSourceContract(pack: EditorialFactPack) {
  for (const source of pack.source_requests) {
    if (source.http_status < 200 || source.http_status >= 300) {
      throw new Error(`source_http_status_invalid:${pack.id}`);
    }
    if (!/^[a-f0-9]{64}$/.test(source.response_sha256)) {
      throw new Error(`source_checksum_invalid:${pack.id}`);
    }
  }
}

function sourceSnapshotHashes(pack: EditorialFactPack) {
  return pack.source_requests.map((source) => ({
    url: source.url,
    sha256: source.response_sha256,
  }));
}

function sourceFactMetric(
  fact: EditorialFactPack["facts"][number],
  id: string,
  label: string,
  dimensions: Record<string, string>,
  precision: number,
): AnalysisMetric {
  if (fact.value === null) throw new Error(`source_fact_missing:${fact.fact_id}`);
  return metric({
    id,
    label,
    value: fact.value,
    unit: fact.unit,
    formulaName: "source_observation",
    formulaVersion: "1.0.0",
    expression: "Use the value exactly as stored in the source fact; no arithmetic.",
    inputFacts: [fact],
    dimensions,
    precision,
  });
}

function classifyInternetEntities(
  pack: EditorialFactPack,
  reference: GeographyReference,
  overrides: GeographyOverrides,
) {
  const ref = new Map(reference.entries.map((entry) => [entry.alpha3, entry]));
  if (
    ref.size !== reference.entry_count ||
    canonicalJsonSha256(reference.entries) !== reference.entries_sha256
  ) {
    throw new Error("country_reference_integrity_mismatch");
  }
  const aggregate = new Map(overrides.aggregates.map((entry) => [entry.code, entry.name]));
  const unresolved = new Map(overrides.unresolved.map((entry) => [entry.code, entry.name]));
  if (
    aggregate.size !== overrides.aggregates.length ||
    unresolved.size !== overrides.unresolved.length
  ) {
    throw new Error("geography_override_duplicate");
  }
  for (const code of [...aggregate.keys(), ...unresolved.keys()]) {
    if (ref.has(code)) throw new Error(`geography_override_conflicts_with_m49:${code}`);
  }

  const entities = new Map<string, string>();
  for (const fact of pack.facts) {
    if (!fact.geography.code) throw new Error(`source_entity_code_missing:${fact.fact_id}`);
    const existing = entities.get(fact.geography.code);
    if (existing && existing !== fact.geography.name) {
      throw new Error(`source_entity_name_inconsistent:${fact.geography.code}`);
    }
    entities.set(fact.geography.code, fact.geography.name);
  }

  const classified = [...entities]
    .map(([code, sourceName]) => {
      const m49 = ref.get(code);
      const aggregateName = aggregate.get(code);
      const unresolvedName = unresolved.get(code);
      if (m49) {
        return {
          code,
          source_name: sourceName,
          classification: "m49_country_or_area" as const,
          reference_name: m49.name,
          m49_code: m49.m49,
        };
      }
      if (aggregateName) {
        if (aggregateName !== sourceName) throw new Error(`aggregate_name_mismatch:${code}`);
        return {
          code,
          source_name: sourceName,
          classification: "aggregate" as const,
          reference_name: null,
          m49_code: null,
        };
      }
      if (unresolvedName) {
        if (unresolvedName !== sourceName) throw new Error(`unresolved_name_mismatch:${code}`);
        return {
          code,
          source_name: sourceName,
          classification: "unresolved" as const,
          reference_name: null,
          m49_code: null,
        };
      }
      throw new Error(`geography_not_classified:${code}`);
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  for (const code of [...aggregate.keys(), ...unresolved.keys()]) {
    if (!entities.has(code)) throw new Error(`unused_geography_override:${code}`);
  }
  return classified;
}

function analyzeInternet(
  pack: EditorialFactPack,
  decision: AnalysisDecision,
  reference: GeographyReference,
  overrides: GeographyOverrides,
  sourcePackSha256: string,
) {
  assertPack(pack, decision);
  assertSourceContract(pack);
  const entities = classifyInternetEntities(pack, reference, overrides);
  const counts = { m49_country_or_area: 0, aggregate: 0, unresolved: 0 };
  for (const entity of entities) counts[entity.classification] += 1;

  const countryAreaCodes = new Set(
    entities
      .filter((entity) => entity.classification === "m49_country_or_area")
      .map((entity) => entity.code),
  );
  const factsByKey = new Map<string, EditorialFactPack["facts"][number]>();
  for (const fact of pack.facts) {
    if (
      fact.unit !== "% of population" ||
      fact.frequency !== "annual" ||
      !/^\d{4}$/.test(fact.period) ||
      Number(fact.period) < 1990 ||
      Number(fact.period) > 2025 ||
      fact.dimensions.series !== "it_net_user_zs" ||
      fact.dimensions.entity_code !== fact.geography.code ||
      fact.dimensions.entity_name !== fact.geography.name
    ) {
      throw new Error(`internet_dimension_or_unit_mismatch:${fact.fact_id}`);
    }
    if (
      fact.status_quality_flag !== "observed_raw_source_value" ||
      fact.missing_value ||
      fact.value === null ||
      fact.value < 0 ||
      fact.value > 100
    ) {
      throw new Error(`internet_value_or_status_invalid:${fact.fact_id}`);
    }
    const key = `${fact.geography.code}|${fact.period}`;
    if (factsByKey.has(key)) throw new Error(`internet_duplicate_entity_year:${key}`);
    factsByKey.set(key, fact);
  }

  const paired = [...countryAreaCodes]
    .map((code) => ({ start: factsByKey.get(`${code}|2000`), end: factsByKey.get(`${code}|2024`) }))
    .filter(
      ({ start, end }) =>
        start &&
        end &&
        !start.missing_value &&
        !end.missing_value &&
        start.value !== null &&
        end.value !== null,
    )
    .sort((a, b) => a.start!.geography.name.localeCompare(b.start!.geography.name));
  const minCohort = 150;
  const gatePassed = paired.length >= minCohort;
  const metrics: AnalysisMetric[] = [];
  if (gatePassed) {
    const changes: number[] = [];
    for (const pair of paired) {
      const start = pair.start!;
      const end = pair.end!;
      const change = end.value! - start.value!;
      changes.push(change);
      metrics.push(
        metric({
          id: `internet-change:${start.geography.code}:2000-2024`,
          label: `${start.geography.name}: change in Internet use`,
          value: change,
          unit: "percentage points",
          formulaName: "difference_in_percentage_points",
          formulaVersion: "1.0.0",
          expression:
            "2024 source percentage minus 2000 source percentage for the same UN M49 country-or-area code.",
          inputFacts: [start, end],
          dimensions: {
            geo_code: start.geography.code!,
            from: "2000",
            to: "2024",
            series: "it_net_user_zs",
          },
          precision: 1,
        }),
      );
    }
    for (const p of [0.25, 0.5, 0.75]) {
      metrics.push(
        metric({
          id: `internet-distribution-p${Math.round(p * 100)}:2000-2024`,
          label: `Paired entity change, percentile ${Math.round(p * 100)}`,
          value: quantileType7(changes, p),
          unit: "percentage points",
          formulaName: "linear_interpolated_sample_quantile_type_7",
          formulaVersion: "1.0.0",
          expression:
            "Sort paired 2024-minus-2000 changes; h=(n-1)p; linearly interpolate between zero-based ranks floor(h) and ceil(h).",
          inputFacts: paired.flatMap(({ start, end }) => [start!, end!]),
          dimensions: {
            cohort: "UN M49 country-or-area entities with both endpoint observations",
            from: "2000",
            to: "2024",
            percentile: String(p),
          },
          precision: 1,
        }),
      );
    }
  }

  return {
    brief_id: pack.id,
    brief_revision: pack.brief_revision,
    status: gatePassed ? ("calculated_for_sol_review" as const) : ("held" as const),
    source_fact_pack_sha256: sourcePackSha256,
    source_snapshot_hashes: sourceSnapshotHashes(pack),
    metrics,
    coverage: {
      classification_counts: counts,
      entities,
      paired_entity_count: paired.length,
      required_minimum: minCohort,
      gate_passed: gatePassed,
      excluded_unresolved_codes: entities
        .filter((entity) => entity.classification === "unresolved")
        .map((entity) => entity.code),
    },
    caveats: [
      "Cohort means source entities whose codes occur in the pinned UN M49 country-or-area list, not a claim of sovereign statehood.",
      "Aggregates and unresolved codes are excluded. A source code is never treated as a country or area by shape alone.",
      "The paired cohort is fixed to non-missing source observations in 2000 and 2024; 2025 is excluded.",
      "The internet-use indicator means use in the previous three months; it does not measure access quality, affordability, or digital skill.",
    ],
  };
}

function quantileType7(values: number[], probability: number) {
  if (values.length === 0) throw new Error("quantile_empty_input");
  if (probability < 0 || probability > 1) throw new Error("quantile_probability_out_of_range");
  const sorted = [...values].sort((a, b) => a - b);
  const h = (sorted.length - 1) * probability;
  const lower = Math.floor(h);
  const upper = Math.ceil(h);
  const lowValue = sorted[lower];
  const highValue = sorted[upper];
  if (lowValue === undefined || highValue === undefined) throw new Error("quantile_rank_invalid");
  return lowValue + (h - lower) * (highValue - lowValue);
}

function analyzeRenewables(
  pack: EditorialFactPack,
  decision: AnalysisDecision,
  sourcePackSha256: string,
) {
  assertPack(pack, decision);
  assertSourceContract(pack);
  const facts = pack.facts;
  if (
    facts.length !== 20 ||
    facts.some(
      (fact) =>
        fact.geography.code !== "EU27_2020" ||
        !Object.hasOwn(RENEWABLE_CATEGORIES, fact.dimensions.nrg_bal) ||
        !["2020", "2021", "2022", "2023", "2024"].includes(fact.period) ||
        fact.frequency !== "Annual" ||
        fact.unit !== "Percentage" ||
        fact.dimensions.freq !== "A" ||
        fact.dimensions.unit !== "PC" ||
        fact.dimensions.geo !== "EU27_2020" ||
        fact.dimensions.time !== fact.period,
    )
  ) {
    throw new Error("renewable_pack_scope_drift");
  }
  const metrics: AnalysisMetric[] = [];
  for (const [category, label] of Object.entries(RENEWABLE_CATEGORIES)) {
    const find = (year: string) =>
      requireUniqueFact(
        facts,
        (fact) =>
          fact.geography.code === "EU27_2020" &&
          fact.period === year &&
          fact.frequency === "Annual" &&
          fact.unit === "Percentage" &&
          fact.dimensions.freq === "A" &&
          fact.dimensions.nrg_bal === category &&
          fact.dimensions.unit === "PC" &&
          fact.dimensions.geo === "EU27_2020" &&
          fact.dimensions.time === year,
        `renewable_${category}_${year}`,
      );
    const start = find("2021");
    const end = find("2024");
    metrics.push(
      sourceFactMetric(
        end,
        `renewable:2024:${category}`,
        `${label} in 2024`,
        { category, geo: "EU27_2020", period: "2024" },
        1,
      ),
    );
    metrics.push(
      metric({
        id: `renewable-change:2021-2024:${category}`,
        label: `${label}: 2021 to 2024 change`,
        value: end.value! - start.value!,
        unit: "percentage points",
        formulaName: "difference_in_percentage_points",
        formulaVersion: "1.0.0",
        expression:
          "2024 source percentage minus 2021 source percentage for the same nrg_bal category.",
        inputFacts: [start, end],
        dimensions: { category, geo: "EU27_2020", from: "2021", to: "2024" },
        precision: 1,
      }),
    );
  }
  if (facts.some((fact) => fact.period === "2025" && fact.dimensions.geo === "EU27_2020")) {
    throw new Error("renewable_2025_must_be_excluded");
  }
  return {
    brief_id: pack.id,
    brief_revision: pack.brief_revision,
    status: "calculated_for_sol_review" as const,
    source_fact_pack_sha256: sourcePackSha256,
    source_snapshot_hashes: sourceSnapshotHashes(pack),
    metrics,
    caveats: [
      "The four categories are separate Eurostat indicators with distinct denominators; they are not additive and are not combined into one average.",
      "The calculation compares 2021 with 2024 within each category. Eurostat reports a RED I/RED II methodology break between 2020 and 2021.",
      "This pack contains the EU27_2020 aggregate only and does not support a member-country comparison.",
    ],
  };
}

function analyzeHicp(
  pack: EditorialFactPack,
  decision: AnalysisDecision,
  sourcePackSha256: string,
) {
  assertPack(pack, decision);
  assertSourceContract(pack);
  const facts = pack.facts;
  const allowedYears = new Set(Array.from({ length: 8 }, (_, index) => String(2018 + index)));
  if (
    facts.length !== 8 ||
    facts.some(
      (fact) =>
        fact.geography.code !== "EU27_2020" ||
        !allowedYears.has(fact.period) ||
        fact.frequency !== "Annual" ||
        fact.unit !== "Annual average rate of change" ||
        fact.dimensions.freq !== "A" ||
        fact.dimensions.unit !== "RCH_A_AVG" ||
        fact.dimensions.coicop18 !== "TOTAL" ||
        fact.dimensions.geo !== "EU27_2020" ||
        fact.dimensions.time !== fact.period,
    )
  ) {
    throw new Error("hicp_pack_scope_drift");
  }
  const byYear = new Map<string, EditorialFactPack["facts"][number]>();
  const metrics: AnalysisMetric[] = [];
  for (const year of Array.from({ length: 8 }, (_, index) => String(2018 + index))) {
    const fact = requireUniqueFact(
      facts,
      (candidate) =>
        candidate.geography.code === "EU27_2020" &&
        candidate.period === year &&
        candidate.frequency === "Annual" &&
        candidate.unit === "Annual average rate of change" &&
        candidate.dimensions.freq === "A" &&
        candidate.dimensions.unit === "RCH_A_AVG" &&
        candidate.dimensions.coicop18 === "TOTAL" &&
        candidate.dimensions.geo === "EU27_2020" &&
        candidate.dimensions.time === year,
      `hicp_${year}`,
    );
    byYear.set(year, fact);
    metrics.push(
      sourceFactMetric(
        fact,
        `hicp-rate:${year}`,
        `EU27 annual-average HICP rate in ${year}`,
        { geo: "EU27_2020", period: year, classification: "TOTAL" },
        1,
      ),
    );
  }
  const start = byYear.get("2024");
  const end = byYear.get("2025");
  if (!start || !end || start.value === null || end.value === null)
    throw new Error("hicp_2024_2025_required");
  metrics.push(
    metric({
      id: "hicp-rate-change:2024-2025",
      label: "Change in annual-average HICP rate, 2024 to 2025",
      value: end.value - start.value,
      unit: "percentage points",
      formulaName: "difference_in_percentage_points",
      formulaVersion: "1.0.0",
      expression:
        "2025 annual-average rate minus 2024 annual-average rate; this is a change in the rate, not a price-level change.",
      inputFacts: [start, end],
      dimensions: { geo: "EU27_2020", from: "2024", to: "2025", classification: "TOTAL" },
      precision: 1,
    }),
  );
  if (
    facts.some(
      (fact) => fact.geography.code !== "EU27_2020" || fact.dimensions.unit !== "RCH_A_AVG",
    )
  ) {
    throw new Error("hicp_scope_drift");
  }
  return {
    brief_id: pack.id,
    brief_revision: pack.brief_revision,
    status: "calculated_for_sol_review" as const,
    source_fact_pack_sha256: sourcePackSha256,
    source_snapshot_hashes: sourceSnapshotHashes(pack),
    metrics,
    caveats: [
      "Values are annual-average HICP rates of change, not index levels, monthly rates, or the price change for an individual household.",
      "The 2024-to-2025 result is a percentage-point change in the rate; the positive 2025 rate does not imply that prices fell.",
      "This is the EU27_2020 aggregate and supports no country or euro-area comparison.",
    ],
  };
}

function analyzeWildfire(
  pack: EditorialFactPack,
  decision: AnalysisDecision,
  sourcePackSha256: string,
) {
  assertPack(pack, decision);
  assertSourceContract(pack);
  const metrics: AnalysisMetric[] = [];
  const get = (series: string, year: number) =>
    requireUniqueFact(
      pack.facts,
      (fact) =>
        fact.geography.code === "OWID_WRL" &&
        fact.period === String(year) &&
        fact.frequency === "annual" &&
        fact.unit === "hectares" &&
        fact.dimensions.entity_code === "OWID_WRL" &&
        fact.dimensions.entity_name === "World" &&
        fact.dimensions.series === series,
      `wildfire_${series}_${year}`,
    );
  const yearsByWindow = [
    { key: "early_2002_2006", years: [2002, 2003, 2004, 2005, 2006] },
    { key: "recent_2021_2025", years: [2021, 2022, 2023, 2024, 2025] },
  ];
  for (const [series, label] of Object.entries(WILDFIRE_CATEGORIES)) {
    const windowFacts = yearsByWindow.map((window) => ({
      ...window,
      facts: window.years.map((year) => get(series, year)),
    }));
    const means = windowFacts.map((window) => {
      const values = window.facts.map((fact) => fact.value);
      if (values.some((value) => value === null))
        throw new Error(`wildfire_window_missing:${series}:${window.key}`);
      if (values.some((value) => value! < 0))
        throw new Error(`wildfire_negative_area:${series}:${window.key}`);
      const mean = (values as number[]).reduce((sum, value) => sum + value, 0) / values.length;
      const metricResult = metric({
        id: `wildfire-mean:${series}:${window.key}`,
        label: `${label}: mean annual area burned, ${window.years[0]}–${window.years.at(-1)}`,
        value: mean,
        unit: "hectares",
        formulaName: "arithmetic_mean_of_five_annual_observations",
        formulaVersion: "1.0.0",
        expression: `Sum the five non-missing World ${series} observations for ${window.years[0]}–${window.years.at(-1)} and divide by 5.`,
        inputFacts: window.facts,
        dimensions: {
          geo: "OWID_WRL",
          series,
          from: String(window.years[0]),
          to: String(window.years.at(-1)),
        },
        displayUnit: "million hectares",
        displayScale: 1_000_000,
        precision: 1,
      });
      metrics.push(metricResult);
      return { value: mean, facts: window.facts, metric: metricResult };
    });
    const early = means[0];
    const recent = means[1];
    if (!early || !recent) throw new Error(`wildfire_windows_invalid:${series}`);
    const delta = recent.value - early.value;
    metrics.push(
      metric({
        id: `wildfire-mean-difference:${series}:early-v-recent`,
        label: `${label}: difference between five-year means`,
        value: delta,
        unit: "hectares",
        formulaName: "difference_between_period_means",
        formulaVersion: "1.0.0",
        expression: "2021–2025 mean minus 2002–2006 mean for the same source land-cover series.",
        inputFacts: [...early.facts, ...recent.facts],
        dimensions: {
          geo: "OWID_WRL",
          series,
          early_window: "2002-2006",
          recent_window: "2021-2025",
        },
        displayUnit: "million hectares",
        displayScale: 1_000_000,
        precision: 1,
      }),
    );
    if (early.value <= 0)
      throw new Error(`wildfire_relative_change_denominator_not_positive:${series}`);
    metrics.push(
      metric({
        id: `wildfire-relative-change:${series}:early-v-recent`,
        label: `${label}: relative change between five-year means`,
        value: (delta / early.value) * 100,
        unit: "percent",
        formulaName: "relative_difference_between_period_means",
        formulaVersion: "1.0.0",
        expression: "100 × (recent five-year mean − early five-year mean) ÷ early five-year mean.",
        inputFacts: [...early.facts, ...recent.facts],
        dimensions: {
          geo: "OWID_WRL",
          series,
          early_window: "2002-2006",
          recent_window: "2021-2025",
        },
        precision: 0,
      }),
    );
  }
  return {
    brief_id: pack.id,
    brief_revision: pack.brief_revision,
    status: "calculated_for_sol_review" as const,
    source_fact_pack_sha256: sourcePackSha256,
    source_snapshot_hashes: sourceSnapshotHashes(pack),
    metrics,
    caveats: [
      "Only the four selected land-cover categories are calculated. They are not an exhaustive total of global burned area.",
      "The source warns that historical NASA MODIS-based estimates can underestimate burned areas and fire occurrences.",
      "Burned area is not a measure of fire count, intensity, emissions, damages, or risk.",
      "Each comparison is between five-year annual means, not two single-year observations.",
    ],
  };
}

export function buildEditorialAnalyses(args: {
  factPacks: Record<string, EditorialFactPack>;
  decisions: AnalysisDecisionFile;
  decisionFileSha256: string;
  reference: GeographyReference;
  overrides: GeographyOverrides;
  packSha256ById: Record<string, string>;
}): EditorialAnalysisOutput {
  if (args.decisions.step !== 7 || args.decisions.status !== "fact_pack_scope_review_complete") {
    throw new Error("analysis_decision_file_not_step_7_approved");
  }
  const expectedDecisionIds = new Set([
    "cb-001-internet-adoption-gap",
    "cb-002-eu-renewable-share-patterns",
    "cb-003-hicp-inflation-explainer",
    "cb-004-wildfire-land-cover",
    "cb-005-embedding-reviewed-calculators",
  ]);
  const actualDecisionIds = args.decisions.decisions.map((decision) => decision.brief_id);
  if (
    actualDecisionIds.length !== expectedDecisionIds.size ||
    new Set(actualDecisionIds).size !== actualDecisionIds.length ||
    actualDecisionIds.some((id) => !expectedDecisionIds.has(id))
  ) {
    throw new Error("analysis_decision_coverage_mismatch");
  }
  const analyses: EditorialAnalysisOutput["analyses"] = [];
  const requiredPacks = [
    "cb-001-internet-adoption-gap",
    "cb-002-eu-renewable-share-patterns",
    "cb-003-hicp-inflation-explainer",
    "cb-004-wildfire-land-cover",
  ];
  for (const briefId of requiredPacks) {
    const pack = args.factPacks[briefId];
    const decision = args.decisions.decisions.find((entry) => entry.brief_id === briefId);
    const packSha = args.packSha256ById[briefId];
    if (!pack || !decision || !packSha) throw new Error(`analysis_input_missing:${briefId}`);
    if (briefId === "cb-001-internet-adoption-gap") {
      analyses.push(analyzeInternet(pack, decision, args.reference, args.overrides, packSha));
    } else if (briefId === "cb-002-eu-renewable-share-patterns") {
      analyses.push(analyzeRenewables(pack, decision, packSha));
    } else if (briefId === "cb-003-hicp-inflation-explainer") {
      analyses.push(analyzeHicp(pack, decision, packSha));
    } else {
      analyses.push(analyzeWildfire(pack, decision, packSha));
    }
  }
  const creatorDecision = args.decisions.decisions.find(
    (entry) => entry.brief_id === "cb-005-embedding-reviewed-calculators",
  );
  if (!creatorDecision || creatorDecision.decision !== "hold_manual_verification") {
    throw new Error("creator_guide_must_remain_held");
  }
  analyses.push({
    brief_id: creatorDecision.brief_id,
    brief_revision: creatorDecision.brief_revision,
    status: "held",
    source_fact_pack_sha256: "",
    source_snapshot_hashes: [],
    metrics: [],
    caveats: [
      "Live rights, route, embed, attribution, keyboard, and mobile checks remain incomplete.",
    ],
  });
  return {
    schema_version: "1.0.0",
    step: 8,
    publication_effect: "none",
    decision_file_sha256: args.decisionFileSha256,
    country_reference: {
      id: args.reference.reference_id,
      version: args.reference.version,
      source_url: args.reference.source_url,
      response_sha256: args.reference.response_sha256,
      entries_sha256: args.reference.entries_sha256,
      entry_count: args.reference.entry_count,
    },
    analyses,
  };
}
