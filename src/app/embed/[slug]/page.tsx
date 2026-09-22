import { notFound } from "next/navigation";

import { WorldBankBarChart } from "@/components/worldbank-bar-chart";
import {
  parseWorldBankIndicator,
  parseWorldBankMetadataPoints,
} from "@/lib/assets/worldbank-chart";
import { fetchWorldBankPreview } from "@/lib/assets/worldbank-preview";
import {
  formatEurostatObservationValue,
  isReviewedEurostatSample,
  parseEurostatSample,
} from "@/lib/ingest/eurostat-presentation";
import { getDatabase } from "@/lib/db/client";
import { getPublishedAssetBySlug } from "@/lib/assets/get-asset";

export const metadata = {
  title: "Cite Supply data embed",
  robots: "noindex, nofollow",
};

type EmbedRights = {
  marketplace_rendered_embed_allowed?: boolean | null;
  embed_provenance?: "source_hosted" | "marketplace_rendered" | null;
  embed_review_version?: string | null;
  automated_review_completed?: boolean | null;
  automated_review_version?: string | null;
};

const WORLD_BANK_REVIEW_VERSION = "worldbank-indicator-metadata-cc-by-v1";
const WORLD_BANK_EMBED_REVIEW_VERSION = "worldbank-marketplace-chart-cc-by-v1";

export default async function MarketplaceEmbedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!/^(?:eurostat|worldbank)-[a-z0-9][a-z0-9._-]{1,63}$/u.test(slug)) notFound();

  let record: Awaited<ReturnType<typeof getPublishedAssetBySlug>>;
  try {
    record = await getPublishedAssetBySlug(getDatabase(), slug);
  } catch {
    notFound();
  }
  if (!record) notFound();

  const rights = parseEmbedRights(record.asset.rights_json);
  if (
    rights.marketplace_rendered_embed_allowed !== true ||
    rights.embed_provenance !== "marketplace_rendered"
  ) {
    notFound();
  }

  const sourceHref = safeHttpsUrl(record.asset.canonical_url);
  if (!sourceHref) notFound();

  if (record.asset.source_id === "source_worldbank") {
    return renderWorldBankEmbed(record, rights, sourceHref);
  }
  if (record.asset.source_id !== "source_eurostat") notFound();

  const sample = parseEurostatSample(record.asset.metadata_json);
  if (!sample || !isReviewedEurostatSample(sample)) notFound();

  return (
    <main className="marketplace-embed" data-embed-provenance="marketplace_rendered">
      <header className="marketplace-embed__header">
        <div>
          <p className="eyebrow">Eurostat data · {sample.datasetCode}</p>
          <h1 className={embedTitleClassName(record.asset.title)} title={record.asset.title}>
            {record.asset.title}
          </h1>
        </div>
        <span className="marketplace-embed__badge">Custom EU27 selection</span>
      </header>

      <div className="marketplace-embed__table-wrap">
        <table>
          <caption className="sr-only">
            Reviewed Eurostat observations for {sample.datasetCode}
          </caption>
          <thead>
            <tr>
              {sample.dimensions.map((dimension) => (
                <th key={dimension.id} scope="col">
                  {dimension.label}
                </th>
              ))}
              <th scope="col">Value</th>
              <th scope="col">Flag</th>
            </tr>
          </thead>
          <tbody>
            {sample.observations.map((observation, index) => (
              <tr key={`${index}-${observation.value}`}>
                {sample.dimensions.map((dimension) => (
                  <td key={dimension.id}>
                    {observation.labels[dimension.id] ??
                      observation.coordinates[dimension.id] ??
                      "—"}
                  </td>
                ))}
                <td className="marketplace-embed__value">
                  {formatEurostatObservationValue(observation.value)}
                </td>
                <td>{observation.status ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="marketplace-embed__footer">
        <p>
          Showing {sample.observations.length} of {sample.observationCount} retained observations ·{" "}
          geo={sample.selector.geo} · sinceTimePeriod={sample.selector.sinceTimePeriod}
        </p>
        <p>
          Source: Eurostat, {record.asset.title} ({sample.datasetCode}), accessed{" "}
          {formatAccessDate(record.asset.last_checked_at)}.
        </p>
        <p>
          Custom EU27 selection from 2020; not the complete Eurostat dataset. This is a customised
          presentation by Cite Supply, not an official Eurostat embed. Eurostat does not endorse and
          is not responsible for this customised presentation.
        </p>
        <a href={sourceHref} rel="noreferrer">
          View the canonical Eurostat Data Browser source
        </a>
      </footer>
    </main>
  );
}

async function renderWorldBankEmbed(
  record: NonNullable<Awaited<ReturnType<typeof getPublishedAssetBySlug>>>,
  rights: EmbedRights,
  sourceHref: string,
) {
  if (
    record.asset.license_code !== "CC_BY" ||
    rights.embed_review_version !== WORLD_BANK_EMBED_REVIEW_VERSION ||
    rights.automated_review_completed !== true ||
    rights.automated_review_version !== WORLD_BANK_REVIEW_VERSION
  ) {
    notFound();
  }

  const indicator = parseWorldBankIndicator(record.asset.metadata_json, record.asset.canonical_url);
  if (!indicator) notFound();

  let points = parseWorldBankMetadataPoints(record.asset.metadata_json);
  try {
    points = await fetchWorldBankPreview(indicator);
  } catch {
    if (points.length === 0) notFound();
  }

  return (
    <main className="marketplace-embed" data-embed-provenance="marketplace_rendered">
      <header className="marketplace-embed__header">
        <div>
          <p className="eyebrow">World Bank Open Data · {indicator}</p>
          <h1 className={embedTitleClassName(record.asset.title)} title={record.asset.title}>
            {record.asset.title}
          </h1>
        </div>
        <span className="marketplace-embed__badge">Latest observations</span>
      </header>

      <div className="worldbank-chart marketplace-embed__worldbank-chart">
        <div className="worldbank-chart__header">
          <span>Data chart</span>
          <span>{indicator}</span>
        </div>
        <WorldBankBarChart points={points} title={record.asset.title} />
        <p className="worldbank-chart__note">
          Latest non-empty observations returned by the official World Bank Indicators API.
        </p>
      </div>

      <footer className="marketplace-embed__footer">
        <p>
          Source: World Bank Open Data, {record.asset.title} ({indicator}), accessed{" "}
          {formatAccessDate(record.asset.last_checked_at)}.
        </p>
        <p>
          Licensed under CC BY 4.0. This chart is a customised presentation by Cite Supply, not an
          official World Bank embed. The World Bank does not endorse this presentation.
        </p>
        <div className="marketplace-embed__footer-links">
          <a href={sourceHref} rel="noreferrer">
            View the canonical World Bank source
          </a>
          <a href="https://creativecommons.org/licenses/by/4.0/" rel="noreferrer">
            CC BY 4.0
          </a>
        </div>
      </footer>
    </main>
  );
}

function parseEmbedRights(value: string | null): EmbedRights {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as EmbedRights) : {};
  } catch {
    return {};
  }
}

function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatAccessDate(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return "date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function embedTitleClassName(title: string): string | undefined {
  return title.length > 140 ? "marketplace-embed__title--long" : undefined;
}
