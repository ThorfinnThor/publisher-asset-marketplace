import analysisResultsJson from "../../../data/editorial/analysis-results.json";
import internetDraftJson from "../../../content/editorial/drafts/internet-use-grew-at-different-speeds.json";
import renewablesDraftJson from "../../../content/editorial/drafts/reading-eu-renewables-by-energy-use.json";
import hicpDraftJson from "../../../content/editorial/drafts/what-eu-hicp-inflation-rate-means.json";
import wildfireDraftJson from "../../../content/editorial/drafts/world-burned-area-across-four-land-cover-types.json";

import type { EditorialAnalysisOutput, AnalysisMetric } from "./analysis";
import { EditorialArticleDraftSchema, type EditorialArticleDraft } from "./article-schema";

const PUBLICATION_DATE = "2026-09-26T00:00:00.000Z";

const analysisResults = analysisResultsJson as unknown as EditorialAnalysisOutput;

const publications = [
  {
    draft: internetDraftJson,
    section: "Digital access",
    sourceLabel: "ITU via World Bank and Our World in Data",
  },
  {
    draft: renewablesDraftJson,
    section: "Energy",
    sourceLabel: "Eurostat",
  },
  {
    draft: hicpDraftJson,
    section: "Prices",
    sourceLabel: "Eurostat",
  },
  {
    draft: wildfireDraftJson,
    section: "Environment",
    sourceLabel: "GWIS via Our World in Data",
  },
] as const;

export type PublicEditorialArticle = {
  draft: EditorialArticleDraft;
  section: string;
  sourceLabel: string;
  datePublished: string;
  dateModified: string;
  metrics: ReadonlyMap<string, AnalysisMetric>;
};

export const PUBLIC_EDITORIAL_ARTICLES: readonly PublicEditorialArticle[] = publications.map(
  ({ draft: draftInput, section, sourceLabel }) => {
    const draft = EditorialArticleDraftSchema.parse(draftInput);
    const analysis = analysisResults.analyses.find((entry) => entry.brief_id === draft.brief_id);
    if (!analysis || analysis.status !== "calculated_for_sol_review") {
      throw new Error(`public_editorial_analysis_missing:${draft.brief_id}`);
    }
    return {
      draft,
      section,
      sourceLabel,
      datePublished: PUBLICATION_DATE,
      dateModified:
        Date.parse(draft.date_modified) > Date.parse(PUBLICATION_DATE)
          ? draft.date_modified
          : PUBLICATION_DATE,
      metrics: new Map(analysis.metrics.map((metric) => [metric.metric_id, metric])),
    };
  },
);

export function getPublicEditorialArticle(slug: string): PublicEditorialArticle | null {
  return PUBLIC_EDITORIAL_ARTICLES.find((article) => article.draft.slug === slug) ?? null;
}

export function formatEditorialMetric(metric: AnalysisMetric): string {
  const value = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: metric.display.precision,
    maximumFractionDigits: metric.display.precision,
  }).format(metric.display.value);
  const unit = metric.display.unit.toLowerCase();
  if (unit === "percentage") return `${value}%`;
  if (unit === "annual average rate of change") return `${value}%`;
  return `${value} ${metric.display.unit}`;
}

export function editorialArticleWordCount(draft: EditorialArticleDraft): number {
  const text = [
    draft.title,
    draft.dek,
    ...draft.blocks.flatMap((block) => {
      if (block.type === "data_table") {
        return [block.heading, block.caption, ...block.rows.map((row) => row.label)];
      }
      if (block.type === "asset_link") return [block.label, block.context];
      if (block.type === "finding" || block.type === "method" || block.type === "limitation") {
        return [block.heading, block.text];
      }
      return [block.text];
    }),
  ].join(" ");
  return text.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}
