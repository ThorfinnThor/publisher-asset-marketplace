export type TopicDefinition = {
  slug: string;
  name: string;
  description: string;
  query: string;
  seoTitle: string;
  seoDescription: string;
  introduction: readonly [string, string];
  questions: readonly string[];
  sourceGuidance: string;
};

export const TOPICS: readonly TopicDefinition[] = [
  {
    slug: "population-and-society",
    name: "Population and society",
    description: "Population, migration, households, cities and social conditions.",
    query: "population",
    seoTitle: "Population and society data",
    seoDescription:
      "Explore reviewed population and society datasets with their source, update date, reuse terms and citation details.",
    introduction: [
      "Population statistics help explain how places change: whether a country is growing or ageing, where people move, and how households and cities develop. The catalog brings together reviewed assets from public statistical sources so that publishers can compare definitions, dates and geographic coverage before using a number.",
      "A population figure is only meaningful when its reference date and measurement method are clear. Census counts, modeled estimates and administrative records can describe the same place differently. Open an asset to inspect its canonical source, freshness, reuse conditions and the exact citation supplied for publication.",
    ],
    questions: [
      "How quickly is a population growing, shrinking or ageing?",
      "How do migration and urbanization differ across countries or years?",
      "Which source and definition support the comparison you want to publish?",
    ],
    sourceGuidance:
      "Check whether an observation is a census count, estimate, rate or absolute total. Keep the reporting year and geographic definition beside any comparison, especially when borders or methodology changed.",
  },
  {
    slug: "economy-and-finance",
    name: "Economy and finance",
    description: "Growth, prices, trade, banking, public finance and business indicators.",
    query: "economy",
    seoTitle: "Economy and finance data",
    seoDescription:
      "Find reviewed economic and financial datasets with visible sources, update dates, definitions and reuse conditions.",
    introduction: [
      "Economic indicators can look comparable while measuring different things. Nominal and real values, current and constant prices, totals and per-capita measures answer distinct questions. This collection helps publishers find source-backed assets and inspect those distinctions before turning a statistic into a headline or chart.",
      "The results cover macroeconomic, trade, price, banking and public-finance subjects. Cite Supply does not reinterpret the source methodology: each asset points back to the canonical provider and shows the latest known update and reuse evidence, making it easier to verify a figure before publication.",
    ],
    questions: [
      "Is a value nominal, inflation-adjusted, per person or an aggregate?",
      "Do two countries use the same period, currency and accounting definition?",
      "Which primary dataset should be cited for the published claim?",
    ],
    sourceGuidance:
      "Read the unit and price basis before comparing values. For rates and ratios, confirm the denominator; for monetary series, preserve the source currency, reference year and any seasonal adjustment.",
  },
  {
    slug: "health",
    name: "Health",
    description: "Life expectancy, mortality, healthcare and public-health measures.",
    query: "health",
    seoTitle: "Health and public-health data",
    seoDescription:
      "Browse reviewed health datasets and charts with primary sources, update dates, definitions and reuse information.",
    introduction: [
      "Health data is unusually sensitive to definitions, reporting delays and differences in surveillance. Mortality, life expectancy, disease prevalence and service coverage may come from registrations, surveys or modeled estimates. The assets below are selected to keep those source details visible rather than presenting a number without context.",
      "Use this topic page as a route into the reviewed catalog, not as medical advice. Each asset links to its original publisher and records its freshness and reuse conditions. When a measure can change with age structure or testing practice, consult the provider’s metadata before drawing conclusions.",
    ],
    questions: [
      "Is the measure observed, surveyed or modeled?",
      "Does the rate account for population size or age structure?",
      "How current is the reporting period compared with the publication date?",
    ],
    sourceGuidance:
      "Avoid treating differently defined health measures as interchangeable. Retain age group, sex, geography, time period and uncertainty information wherever the source provides them.",
  },
  {
    slug: "energy-and-climate",
    name: "Energy and climate",
    description: "Electricity, renewables, emissions, climate and energy prices.",
    query: "energy",
    seoTitle: "Energy and climate data",
    seoDescription:
      "Explore energy and climate datasets with reviewed sources, current dates, measurement context and reuse terms.",
    introduction: [
      "Energy and climate reporting often connects several layers of evidence: generation, consumption, capacity, emissions and prices. A country can increase renewable capacity while its total energy demand also rises, so the choice of denominator and time range materially changes the story. These reviewed assets make the underlying source and unit easier to inspect.",
      "The collection includes public datasets suitable for research and publication when their stated conditions are followed. Asset pages show whether an embed is available, how to cite the source and when the record was last checked. They also distinguish marketplace-rendered presentations from source-hosted material.",
    ],
    questions: [
      "Does the series measure capacity, generation, consumption or share?",
      "Are emissions territorial, consumption-based or sector-specific?",
      "Which years and units support a fair comparison?",
    ],
    sourceGuidance:
      "Keep energy units and system boundaries explicit. For climate indicators, preserve the baseline, scope and whether values are absolute totals, intensities or percentage shares.",
  },
  {
    slug: "technology-and-infrastructure",
    name: "Technology and infrastructure",
    description: "Internet access, digital adoption, transport and infrastructure.",
    query: "internet",
    seoTitle: "Technology and infrastructure data",
    seoDescription:
      "Find reviewed technology and infrastructure data with source links, dates, definitions and publishing conditions.",
    introduction: [
      "Technology indicators describe access as well as adoption. Internet use, broadband subscriptions, network coverage and digital services are related, but they do not measure the same behavior. The catalog surfaces reviewed source assets so publishers can choose a series that actually fits the question being asked.",
      "Infrastructure data also needs geographic and temporal context: national averages can hide rural gaps, and rapidly changing technologies make old observations misleading. Every result below links to its source record and shows the update information and reuse status known to Cite Supply.",
    ],
    questions: [
      "Does the indicator measure availability, subscriptions or active use?",
      "Is the value a national average or split by place and population group?",
      "Has the definition remained stable as the technology changed?",
    ],
    sourceGuidance:
      "Use the provider’s definition rather than a shortened label alone. Report the observation year and avoid equating subscriptions with people when individuals may hold multiple services.",
  },
  {
    slug: "education-and-work",
    name: "Education and work",
    description: "Education, skills, employment, wages and labor-market indicators.",
    query: "education",
    seoTitle: "Education and work data",
    seoDescription:
      "Browse education and labor-market datasets with reviewed provenance, dates, definitions and reuse information.",
    introduction: [
      "Education and labor-market statistics connect learning, qualifications, employment and earnings, but the populations behind them vary. Enrollment is not the same as attendance or completion; unemployment excludes people outside the labor force. This collection helps publishers locate reviewed assets without losing those methodological boundaries.",
      "Results link directly to the responsible source and retain the latest known observation or update information. Before comparing places, check age ranges, education levels, full-time or part-time coverage and whether monetary values have been adjusted for inflation or purchasing power.",
    ],
    questions: [
      "Which age group and education level does the measure cover?",
      "Is a labor statistic a count, population share or labor-force rate?",
      "Are wage values comparable across time, currencies and working patterns?",
    ],
    sourceGuidance:
      "Preserve the source’s population and level definitions. For labor comparisons, distinguish employment, unemployment and participation, and state whether data is seasonally adjusted.",
  },
  {
    slug: "environment-and-land",
    name: "Environment and land",
    description: "Land use, agriculture, forests, biodiversity, water and wildfires.",
    query: "environment",
    seoTitle: "Environment and land data",
    seoDescription:
      "Explore reviewed environmental and land datasets with transparent sources, dates, geographic coverage and reuse terms.",
    introduction: [
      "Environmental statistics combine measurements taken on the ground, remote sensing, administrative reporting and models. Forest area, agricultural land, water stress and biodiversity indicators therefore carry different spatial resolution and uncertainty. The assets here retain links to the primary provider so those limits can be checked.",
      "A trend may also depend on the chosen baseline or classification system. Cite Supply shows source, freshness and rights evidence on each asset page and only exposes reuse actions that match the reviewed conditions. Publishers remain responsible for representing the original definitions accurately.",
    ],
    questions: [
      "Is the observation measured, mapped, reported or modeled?",
      "What geographic resolution and classification does the source use?",
      "Is the change absolute, percentage-based or relative to a baseline?",
    ],
    sourceGuidance:
      "Keep spatial coverage, baseline and measurement method with the result. Do not infer local conditions from national averages when the source does not support that resolution.",
  },
  {
    slug: "publisher-tools",
    name: "Publisher tools",
    description: "Calculators, benchmarks and interactive tools made for practical use.",
    query: "calculator",
    seoTitle: "Calculators and tools for publishers",
    seoDescription:
      "Discover reviewed calculators, benchmarks and interactive tools with clear sources and embedding conditions.",
    introduction: [
      "Interactive calculators and benchmarks can make an article more useful, but only when readers can understand the inputs, result and limitations. This topic groups practical tools whose public pages expose their source identity, freshness and reviewed usage conditions before a publisher copies an embed.",
      "Some tools are hosted by their original creator; others use a Cite Supply-rendered presentation of reviewed source data. The asset page labels that distinction and disables embed actions when the evidence does not permit them. Always test an interactive tool in the context where it will appear.",
    ],
    questions: [
      "Which inputs and assumptions determine the result?",
      "Is the embed source-hosted or rendered by Cite Supply?",
      "What attribution and commercial-use conditions apply?",
    ],
    sourceGuidance:
      "Treat calculator output as an estimate unless the source explicitly states otherwise. Keep explanatory labels and attribution with the embed, and do not imply professional advice.",
  },
] as const;

export function getTopic(slug: string): TopicDefinition | undefined {
  return TOPICS.find((topic) => topic.slug === slug);
}
