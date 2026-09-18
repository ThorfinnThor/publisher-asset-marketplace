export type DesignAsset = {
  slug: string;
  title: string;
  description: string;
  source: string;
  sourceUrl: string;
  assetType: "Chart" | "Calculator" | "Dataset" | "Benchmark";
  topic: string;
  checkedAt: string;
  preview: "line" | "bars" | "steps";
  previewUrl: string;
};

export const designAssets: DesignAsset[] = [
  {
    slug: "cost-of-sequencing-a-full-human-genome",
    title: "Cost of sequencing a full human genome",
    description:
      "Explore how the cost of sequencing a human genome has changed as sequencing technology improved.",
    source: "Our World in Data",
    sourceUrl: "https://ourworldindata.org/grapher/cost-of-sequencing-a-full-human-genome",
    assetType: "Chart",
    topic: "Technology",
    checkedAt: "Checked Sep 12, 2026",
    preview: "steps",
    previewUrl:
      "https://ourworldindata.org/grapher/cost-of-sequencing-a-full-human-genome.png?imType=thumbnail&imWidth=900",
  },
  {
    slug: "share-of-individuals-using-the-internet",
    title: "Share of individuals using the Internet",
    description:
      "Compare internet adoption over time across countries and regions using a source-hosted chart.",
    source: "Our World in Data",
    sourceUrl: "https://ourworldindata.org/grapher/share-of-individuals-using-the-internet",
    assetType: "Chart",
    topic: "Technology",
    checkedAt: "Checked Sep 12, 2026",
    preview: "line",
    previewUrl:
      "https://ourworldindata.org/grapher/share-of-individuals-using-the-internet.png?imType=thumbnail&imWidth=900",
  },
  {
    slug: "solar-photovoltaic-module-prices",
    title: "Solar photovoltaic module prices",
    description:
      "Review the long-run change in solar photovoltaic module prices in a compact chart format.",
    source: "Our World in Data",
    sourceUrl: "https://ourworldindata.org/grapher/solar-pv-prices",
    assetType: "Chart",
    topic: "Energy",
    checkedAt: "Checked Sep 12, 2026",
    preview: "bars",
    previewUrl:
      "https://ourworldindata.org/grapher/solar-pv-prices.png?imType=thumbnail&imWidth=900",
  },
];

export function findDesignAsset(slug: string) {
  return designAssets.find((asset) => asset.slug === slug);
}
