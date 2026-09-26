import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const analysisPath = "data/editorial/analysis-results.json";
const analysisBytes = readFileSync(path.join(root, analysisPath));
const analysisHash = createHash("sha256").update(analysisBytes).digest("hex");
const analysisFile = JSON.parse(analysisBytes.toString("utf8")) as {
  analyses: { brief_id: string; metrics: { metric_id: string; value: number }[] }[];
};

const esc = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const fmt = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

type Citation = { id: string; title: string; publisher: string; url: string };
type DraftBlock = {
  id: string;
  type: string;
  text?: string;
  heading?: string;
  caption?: string;
  columns?: string[];
  rows?: { label: string; metric_refs: string[] }[];
  label?: string;
  context?: string;
};
type Draft = {
  slug: string;
  title: string;
  dek: string;
  brief_id: string;
  analysis_results_sha256: string;
  substantive_words?: number;
  citations: Citation[];
  blocks: DraftBlock[];
};

const getMetric = (analysis: { metrics: { metric_id: string; value: number }[] }, id: string) => {
  const found = analysis.metrics.find((metric) => metric.metric_id === id);
  if (!found || typeof found.value !== "number") throw new Error(`approved_metric_missing:${id}`);
  return found.value;
};

const cite = (draft: Draft, id: string) => {
  const source = draft.citations.find((citation) => citation.id === id);
  if (!source) throw new Error(`citation_missing:${id}`);
  return `<p class="method-source" data-citation-id="${esc(id)}">Source: <a href="${esc(source.url)}">${esc(source.title)}</a> — ${esc(source.publisher)}.</p>`;
};

const renderHicp = (
  draft: Draft,
  analysis: { metrics: { metric_id: string; value: number }[] },
) => {
  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const refs = years.map((year) => `hicp-rate:${year}`);
  const values = refs.map((ref) => getMetric(analysis, ref));
  const chartWidth = 760;
  const chartHeight = 250;
  const xStart = 75;
  const xEnd = 700;
  const yTop = 45;
  const yBottom = 200;
  const max = 10;
  const xStep = (xEnd - xStart) / (years.length - 1);
  const y = (value: number) => yBottom - (value / max) * (yBottom - yTop);
  const points = values
    .map((value, index) => `${(xStart + index * xStep).toFixed(2)},${y(value).toFixed(2)}`)
    .join(" ");
  const yTicks = [0, 5, 10];
  const chart = `<figure aria-labelledby="hicp-caption"><figcaption id="hicp-caption"><strong>EU27 annual-average HICP rate</strong><span>All-items total · annual rate of change · 2018–2025</span></figcaption><svg viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-labelledby="hicp-title hicp-desc" data-metric-refs="${refs.join(" ")}" data-chart-x-domain="${xStart} ${xEnd}" data-chart-y-domain="0 ${max}" data-y-ticks="${yTicks.join(" ")}"><title id="hicp-title">EU27 annual-average HICP rates from 2018 to 2025</title><desc id="hicp-desc">Rates are ${values.map((value, index) => `${years[index]} ${fmt.format(value)} percent`).join(", ")}. This is a rate of change, not an index level.</desc>${yTicks.map((tick) => `<line class="${tick === 0 ? "axis" : "grid"}" x1="${xStart - 20}" y1="${y(tick).toFixed(2)}" x2="${xEnd + 10}" y2="${y(tick).toFixed(2)}"/><text class="y-tick" x="${xStart - 28}" y="${(y(tick) + 5).toFixed(2)}" text-anchor="end">${tick}%</text>`).join("")}<polyline class="line" points="${points}"/>${years
    .map((year, index) => {
      const x = xStart + index * xStep;
      const valueY = y(values[index]);
      return `<circle class="point" cx="${x.toFixed(2)}" cy="${valueY.toFixed(2)}" r="4"/><text class="point-value" x="${x.toFixed(2)}" y="${(valueY - 10).toFixed(2)}" text-anchor="middle">${fmt.format(values[index])}%</text><text class="tick" x="${x.toFixed(2)}" y="228" text-anchor="middle">${years[index]}</text>`;
    })
    .join(
      "",
    )}<text class="unit" x="${xStart - 18}" y="28">%</text></svg><table aria-label="EU27 annual-average HICP rates"><thead><tr><th scope="col">Year</th><th scope="col">Rate</th></tr></thead><tbody>${years.map((year, index) => `<tr><th scope="row">${year}</th><td>${fmt.format(values[index])}%</td></tr>`).join("")}</tbody></table>${cite(draft, "eurostat-hicp-table")}</figure>`;
  return chart.replace("<figure ", '<figure tabindex="0" ');
};

const renderRenewables = (
  draft: Draft,
  analysis: { metrics: { metric_id: string; value: number }[] },
) => {
  const items = [
    ["Overall RES", "REN"],
    ["Electricity (RES-E)", "REN_ELC"],
    ["Transport (RES-T)", "REN_TRA"],
    ["Heating and cooling (RES-H&C)", "REN_HEAT_CL"],
  ] as const;
  const values = items.map(([, code]) => getMetric(analysis, `renewable:2024:${code}`));
  const chart = `<figure aria-labelledby="renewables-caption"><figcaption id="renewables-caption"><strong>Four EU27 renewable-energy shares in 2024</strong><span>Each bar is a separate indicator with its own sector scope and denominator.</span></figcaption><svg viewBox="0 0 760 280" role="img" aria-labelledby="renewables-title renewables-desc" data-metric-refs="${items.map(([, code]) => `renewable:2024:${code}`).join(" ")}"><title id="renewables-title">EU27 renewable-energy shares in 2024</title><desc id="renewables-desc">Overall RES ${fmt.format(values[0])} percent, electricity ${fmt.format(values[1])} percent, transport ${fmt.format(values[2])} percent, and heating and cooling ${fmt.format(values[3])} percent. These values must not be added together.</desc><line class="grid" x1="60" y1="35" x2="720" y2="35"/><line class="grid" x1="60" y1="95" x2="720" y2="95"/><line class="grid" x1="60" y1="155" x2="720" y2="155"/><line class="axis" x1="60" y1="215" x2="720" y2="215"/>${values
    .map((value, index) => {
      const x = 95 + index * 155;
      const height = (value / 55) * 160;
      return `<rect class="bar" x="${x}" y="${215 - height}" width="72" height="${height}"/><text class="bar-value" x="${x + 36}" y="${205 - height}" text-anchor="middle">${fmt.format(value)}%</text><text class="label" x="${x + 36}" y="238" text-anchor="middle">${esc(items[index][0])}</text>`;
    })
    .join(
      "",
    )}<text class="unit" x="62" y="25">%</text></svg><table aria-label="EU27 renewable-energy shares in 2024"><thead><tr><th scope="col">Indicator</th><th scope="col">2024 share</th><th scope="col">Change since 2021</th></tr></thead><tbody>${items.map(([label, code]) => `<tr><th scope="row">${esc(label)}</th><td>${fmt.format(getMetric(analysis, `renewable:2024:${code}`))}%</td><td>${fmt.format(getMetric(analysis, `renewable-change:2021-2024:${code}`))} pp</td></tr>`).join("")}</tbody></table>${cite(draft, "eurostat-renewables-table")}</figure>`;
  return chart.replace("<figure ", '<figure tabindex="0" ');
};

const render = (
  draftPath: string,
  outputPath: string,
  figure: (draft: Draft, analysis: { metrics: { metric_id: string; value: number }[] }) => string,
  adjacentSources: Record<string, string | string[]>,
) => {
  const draft = JSON.parse(readFileSync(path.join(root, draftPath), "utf8")) as Draft;
  if (draft.analysis_results_sha256 !== analysisHash)
    throw new Error(`analysis_hash_mismatch:${draft.slug}`);
  const analysis = analysisFile.analyses.find((entry) => entry.brief_id === draft.brief_id);
  if (!analysis) throw new Error(`analysis_missing:${draft.brief_id}`);
  const block = (entry: DraftBlock) => {
    if (entry.type === "data_table") return "";
    if (entry.type === "asset_link")
      return `<aside class="asset"><h2>${esc(entry.label ?? "Open the source asset")}</h2><p>${esc(entry.context ?? "")}</p><a href="${esc(draft.citations[0].url)}">Open Eurostat source</a></aside>`;
    const body =
      entry.type === "prose"
        ? `<p>${esc(entry.text ?? "")}</p>`
        : `<section><h2>${esc(entry.heading ?? "")}</h2><p>${esc(entry.text ?? "")}</p></section>`;
    const sourceIds = adjacentSources[entry.id];
    const ids = sourceIds ? (Array.isArray(sourceIds) ? sourceIds : [sourceIds]) : [];
    return `<div class="editorial-block" data-block-id="${esc(entry.id)}" data-citation-ids="${esc(ids.join(" "))}">${body}${ids.map((sourceId) => cite(draft, sourceId)).join("")}</div>`;
  };
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Private preview: ${esc(draft.title)}</title><style>:root{font-family:Inter,system-ui,sans-serif;color:#171a21;background:#f8f8f6;max-width:100%;overflow-x:hidden}*{box-sizing:border-box}body{max-width:100%;margin:0;padding:clamp(1rem,4vw,3.5rem);line-height:1.68;overflow-x:hidden}main{max-width:980px;min-width:0;margin:auto}.notice{padding:.75rem 1rem;border:1px solid #d9a441;border-radius:.75rem;background:#fff8e8;color:#533a10;font-weight:650}h1{max-width:24ch;font-size:clamp(2rem,5vw,3.7rem);line-height:1.05;letter-spacing:-.04em}h2{margin:2rem 0 .55rem;font-size:clamp(1.3rem,3vw,1.8rem);line-height:1.2}.dek{max-width:70ch;color:#4c535e;font-size:1.2rem}p{max-width:76ch}figcaption{display:grid;gap:.2rem}figure,.asset{contain:inline-size;max-width:100%;margin:2rem 0;padding:clamp(1rem,3vw,2rem);border:1px solid #dedfdf;border-radius:1rem;background:#fff;overflow-x:auto}figure svg{display:block;width:100%;min-width:650px;height:auto}.grid{stroke:#e3e5e7}.axis{stroke:#606874;stroke-width:1.5}.line{fill:none;stroke:#2364e8;stroke-width:4}.point{fill:#2364e8;stroke:#fff;stroke-width:2}.bar{fill:#3775e8}.bar-value,.point-value,.unit{fill:#343a44;font-size:16px;font-weight:700}.label,.tick,.y-tick{fill:#555d68;font-size:13px}table{width:100%;margin-top:1rem;border-collapse:collapse;text-align:left;min-width:520px}th,td{padding:.7rem .5rem;border-top:1px solid #e5e6e7}th{color:#454c56}.method-source{font-size:.92rem;color:#555d68;margin:.45rem 0 0}.sources{margin-top:3rem;padding-top:1rem;border-top:1px solid #d8dadd}a{color:#174dbd;text-underline-offset:.15em}:focus-visible{outline:3px solid #174dbd;outline-offset:3px}@media(max-width:560px){body{padding:1rem}figure,.asset{padding:1rem}}</style></head><body><main><p class="notice">Private editorial review · Not published · No public route or sitemap entry</p><h1>${esc(draft.title)}</h1><p class="dek">${esc(draft.dek)}</p>${figure(draft, analysis)}<article>${draft.blocks.map(block).join("\n")}</article><section class="sources"><h2>Sources and data binding</h2><ul>${draft.citations.map((citation) => `<li><a href="${esc(citation.url)}">${esc(citation.title)}</a> — ${esc(citation.publisher)}</li>`).join("")}</ul><p>All displayed values are resolved from approved metric IDs in the pinned analysis record. Analysis SHA-256: <code>${analysisHash}</code>.</p></section></main></body></html>`;
  writeFileSync(path.join(root, outputPath), html);
  console.log(JSON.stringify({ outputPath, draft: draft.slug, analysisHash }, null, 2));
};

render(
  "content/editorial/drafts/reading-eu-renewables-by-energy-use.json",
  "docs/editorial/previews/cb-002-renewables-private-rendered.html",
  renderRenewables,
  {
    "electricity-denominator": "eurostat-renewables-methodology",
    "transport-scope": "eurostat-transport-2024",
    "heating-cooling-scope": "eurostat-renewable-heating-2024",
    "overall-denominator": "eurostat-renewables-methodology",
    "break-and-method": "eurostat-renewables-methodology",
  },
);
render(
  "content/editorial/drafts/what-eu-hicp-inflation-rate-means.json",
  "docs/editorial/previews/cb-003-hicp-private-rendered.html",
  renderHicp,
  {
    "how-the-annual-average-works": "eurostat-hicp-table",
    "rate-vs-index": "eurostat-hicp-methodology",
    classification: "eurostat-hicp-dataset-mapping",
  },
);
