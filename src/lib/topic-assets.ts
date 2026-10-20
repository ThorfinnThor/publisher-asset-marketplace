import { TOPICS, type TopicDefinition } from "@/lib/topics";

// Curated topic membership for the indexable asset set (migration 0030). Topic
// hubs used to rely on a single keyword search, which matched almost none of the
// 80 indexable assets and left them without crawlable internal links. Each asset
// belongs to exactly one topic so hubs and breadcrumbs agree.
export const TOPIC_ASSET_SLUGS: Readonly<Record<string, readonly string[]>> = {
  "population-and-society": [
    "eurostat-tps00001",
    "natural-population-growth",
    "population-growth-rate-vs-median-age",
    "homelessness-rate-point-in-time-count",
    "equality-of-political-power-across-social-groups-score",
    "key-features-of-human-rights",
    "worldbank-sg.vaw.npsv.1549.lt.me.zs",
    "eurostat-migr_asywitfina",
    "estimated-destroyable-area-by-nuclear-weapons-deliverable-in-first-strike",
    "adequacy-of-social-safety-net-programs",
    "worldbank-per_allsp.adq_q5_pret_tot",
    "worldbank-per_allsp.avt_ep_pret_tot",
    "worldbank-per_allsp.avt_q1_pret_totmr",
    "worldbank-per_allsp.ben_q1_pret_tot",
    "worldbank-per_allsp.ben_q4_pret_tot",
    "worldbank-per_allsp.bry_q3_pret_totmr",
    "worldbank-per_allsp.bry_q5_pret_totfr",
  ],
  "economy-and-finance": [
    "eurostat-nama_10_gdp",
    "eurostat-prc_hicp_ainr",
    "eurostat-ei_bpm6fa_q",
    "number-of-commercial-bank-branches-per-100000-adults",
    "eurostat-tour_ce_oam",
    "eurostat-tour_ce_oar",
    "total-outward-financial-flows-from-drug-trafficking",
  ],
  health: [
    "excess-deaths-cumulative-economist-single-entity",
    "cumulative-deaths-and-cases-covid-19",
    "covid-19-cumulative-confirmed-cases-vs-confirmed-deaths",
    "daily-cases-covid-region",
    "weekly-covid-cases-per-million-people",
    "uk-daily-covid-cases-7day-average",
    "full-list-total-tests-for-covid-19",
    "covid-19-testing-policy",
    "covid-booster-vaccinated-by-age",
    "covid-world-unvaccinated-people",
    "country-reporting-data-on-covid-vaccinations",
    "death-rate-from-suicides-ghe",
  ],
  "energy-and-climate": [
    "solar-pv-prices",
    "years-of-fossil-fuel-reserves-left",
    "elec-fossil-nuclear-renewables",
    "elec-mix-bar",
    "primary-energy-from-fossil-nuclear-renewables",
    "solar-pv-prices-vs-cumulative-capacity",
    "solar-pv-system-costs",
    "fossil-fuel-subsidies-per-capita",
  ],
  "technology-and-infrastructure": [
    "cost-of-sequencing-a-full-human-genome",
    "eurostat-sts_cobp_m",
  ],
  "education-and-work": [
    "eurostat-une_rt_a",
    "population-by-labor-force-status-bars",
    "productivity-vs-educational-attainment",
    "share-of-the-world-population-with-at-least-basic-education",
    "share-of-the-population-with-completed-tertiary-education",
    "primary-secondary-enrollment-completion-rates",
    "share-of-students-achieving-minimum-proficiency-in-reading-and-math-by-education-level",
    "share-of-students-at-end-of-lower-secondary-education-achieving-minimum-math-proficiency",
    "pupil-teacher-ratio-for-primary-education-by-country",
    "share-edu-spending-gdp-vs-share-edu-total-spending",
    "staff-compensation-as-share-of-total-expenditure-in-public-education-all-levels",
    "share-graduates-stem-female",
    "eurostat-tps00217",
    "participation-rate-in-formal-and-non-formal-education-and-training",
    "duration-of-pre-primary-education",
    "official-entrance-age-to-pre-primary-education",
    "share-enrolled-in-private-institutions-at-the-pre-primary-education-level",
    "mainstreaming-sustainable-development-into-student-assessment",
    "eurostat-educ_uoe_fine03",
    "eurostat-educ_uoe_fini02",
    "worldbank-per_lm_alllm.avt_ep_pret_tot",
    "worldbank-per_lm_alllm.avt_pop_totmr",
    "worldbank-per_lm_alllm.avt_q4_pret_totfr",
  ],
  "environment-and-land": [
    "land-area-hectares",
    "macroplastics-in-ocean",
    "medium-high-level-implementation-of-sustainable-public-procurement",
  ],
  "food-and-agriculture": [
    "number-nutritional-diet-unaffordable",
    "severe-food-insecurity-undernourishment",
    "daily-protein-supply-of-animal-origin-vs-plant-origin",
    "protein-efficiency-of-meat-and-dairy-production",
    "share-of-calories-from-animal-protein-vs-mean-male-height",
    "share-cereals-industrial-uses",
    "agriculture-value-added-per-worker-wdi",
    "eurostat-aact_eaa03",
  ],
};

const topicBySlug = new Map<string, TopicDefinition>();
for (const topic of TOPICS) {
  for (const assetSlug of TOPIC_ASSET_SLUGS[topic.slug] ?? []) {
    if (topicBySlug.has(assetSlug)) throw new Error(`duplicate_topic_asset:${assetSlug}`);
    topicBySlug.set(assetSlug, topic);
  }
}

export function topicAssetSlugs(topicSlug: string): readonly string[] {
  return TOPIC_ASSET_SLUGS[topicSlug] ?? [];
}

export function topicForAsset(assetSlug: string): TopicDefinition | undefined {
  return topicBySlug.get(assetSlug);
}
