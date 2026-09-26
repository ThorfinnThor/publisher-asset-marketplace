import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const draftPath = "content/editorial/drafts/internet-use-grew-at-different-speeds.json";
const analysisPath = "data/editorial/analysis-results.json";
const outputPath = "docs/editorial/previews/cb-001-internet-use-private-rendered.html";
const draft = JSON.parse(readFileSync(path.join(root, draftPath), "utf8"));
const analysisBytes = readFileSync(path.join(root, analysisPath));
const analysisHash = createHash("sha256").update(analysisBytes).digest("hex");
if (analysisHash !== draft.analysis_results_sha256) throw new Error("analysis_hash_mismatch");
const analysisFile = JSON.parse(analysisBytes.toString("utf8"));
const analysis = analysisFile.analyses.find(
  (entry: { brief_id: string }) => entry.brief_id === draft.brief_id,
);
if (!analysis?.coverage?.gate_passed) throw new Error("internet_cohort_gate_not_passed");

const wordCount = draft.blocks
  .filter(
    (block: { type: string; id: string }) =>
      ["prose", "finding", "method", "limitation"].includes(block.type) &&
      !["reuse-note", "attribution"].includes(block.id),
  )
  .reduce(
    (total: number, block: { text: string }) =>
      total + (block.text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).length,
    0,
  );
if (wordCount < 500) throw new Error(`substantive_word_minimum_not_met:${wordCount}`);

const metric = (id: string) => {
  const entry = analysis.metrics.find((item: { metric_id: string }) => item.metric_id === id);
  if (!entry || typeof entry.value !== "number") throw new Error(`approved_metric_missing:${id}`);
  return entry.value as number;
};
const metricRefs = [
  "internet-distribution-p25:2000-2024",
  "internet-distribution-p50:2000-2024",
  "internet-distribution-p75:2000-2024",
];
const [p25, p50, p75] = metricRefs.map(metric);
const cohort = analysis.coverage.paired_entity_count;
const x = (value: number) => 70 + (value / 100) * 600;
const fmt = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const esc = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

type RenderBlock =
  | { type: "data_table" }
  | { type: "asset_link"; label: string; context: string }
  | { type: "prose"; text: string }
  | { type: "finding" | "method" | "limitation"; heading: string; text: string };

const chart = `
<figure aria-labelledby="distribution-caption">
  <figcaption id="distribution-caption"><strong>How widely did the change vary?</strong><span>${cohort} matched entities · percentage-point change from 2000 to 2024 · equal weight per entity</span></figcaption>
  <div class="chart-scroll" tabindex="0" role="region" aria-label="Scrollable interval chart; the same values are in the table below">
    <svg viewBox="0 0 760 220" role="img" aria-labelledby="chart-title chart-description" data-metric-refs="${metricRefs.join(" ")} coverage:paired_entity_count">
      <title id="chart-title">Distribution of Internet-use changes across the matched cohort</title>
      <desc id="chart-description">The 25th percentile is ${fmt.format(p25)} percentage points, the median is ${fmt.format(p50)}, and the 75th percentile is ${fmt.format(p75)}. The middle half of changes across ${cohort} matched country-or-area entities falls between the lower and upper quartiles.</desc>
      <line class="grid" x1="70" y1="56" x2="670" y2="56"/><line class="grid" x1="70" y1="104" x2="670" y2="104"/><line class="grid" x1="70" y1="152" x2="670" y2="152"/>
      <line class="axis" x1="70" y1="152" x2="670" y2="152"/><line class="interval" x1="${x(p25).toFixed(2)}" y1="104" x2="${x(p75).toFixed(2)}" y2="104"/><line class="median" x1="${x(p50).toFixed(2)}" y1="76" x2="${x(p50).toFixed(2)}" y2="132"/>
      <g class="tick" text-anchor="middle"><text x="70" y="184">0</text><text x="220" y="184">25</text><text x="370" y="184">50</text><text x="520" y="184">75</text><text x="670" y="184">100 pp</text></g>
      <g class="measure" text-anchor="middle"><text x="${x(p25).toFixed(2)}" y="45">${fmt.format(p25)}</text><text x="${x(p50).toFixed(2)}" y="68">${fmt.format(p50)} median</text><text x="${x(p75).toFixed(2)}" y="45">${fmt.format(p75)}</text></g>
    </svg>
  </div>
  <p class="figure-note">The interval runs from the 25th to the 75th percentile. It shows the middle half of entity-level changes, not the range for half of the world's population.</p>
  <table aria-label="Internet use change distribution summary"><thead><tr><th scope="col">Cohort position</th><th scope="col">Change in share</th></tr></thead><tbody>${metricRefs.map((id, i) => `<tr><th scope="row">${["25th percentile", "Median", "75th percentile"][i]}</th><td>${fmt.format(metric(id))} percentage points</td></tr>`).join("")}</tbody></table>
</figure>`;

const renderBlock = (block: RenderBlock) => {
  if (block.type === "data_table") return "";
  if (block.type === "asset_link")
    return `<aside class="asset"><h2>${esc(block.label)}</h2><p>${esc(block.context)}</p><a href="https://ourworldindata.org/grapher/share-of-individuals-using-the-internet">Open Our World in Data source chart</a></aside>`;
  if (block.type === "prose") return `<p>${esc(block.text)}</p>`;
  if (["finding", "method", "limitation"].includes(block.type))
    return `<section><h2>${esc(block.heading)}</h2><p>${esc(block.text)}</p></section>`;
  throw new Error(`unsupported_article_block:${block.type}`);
};
const sourceList = draft.citations
  .map(
    (citation: { title: string; publisher: string; url: string }) =>
      `<li><a href="${esc(citation.url)}">${esc(citation.title)}</a> — ${esc(citation.publisher)}</li>`,
  )
  .join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Private preview: ${esc(draft.title)}</title>
<style>
:root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171a21;background:#f8f8f6}*{box-sizing:border-box}body{margin:0;padding:clamp(1rem,4vw,3.5rem);line-height:1.68}main{max-width:900px;margin:0 auto}.notice{padding:.75rem 1rem;border:1px solid #d9a441;border-radius:.75rem;background:#fff8e8;color:#533a10;font-weight:650}h1{max-width:20ch;margin:2rem 0 .75rem;font-size:clamp(2rem,5vw,3.5rem);line-height:1.05;letter-spacing:-.04em}h2{margin:2rem 0 .65rem;font-size:clamp(1.35rem,3vw,1.8rem);line-height:1.2}.dek{max-width:68ch;color:#4c535e;font-size:1.2rem;line-height:1.6}p{max-width:72ch}figure,.asset{margin:2rem 0;padding:clamp(1rem,3vw,2rem);border:1px solid #dedfdf;border-radius:1rem;background:#fff}figcaption strong,figcaption span{display:block}figcaption strong{font-size:1.2rem}figcaption span,.figure-note{margin-top:.45rem;color:#545b66}.chart-scroll{max-width:100%;margin-top:1rem;overflow-x:auto;overscroll-behavior-inline:contain}.chart-scroll svg{display:block;width:100%;min-width:560px;height:auto}.grid{stroke:#e3e5e7;stroke-width:1}.axis{stroke:#606874;stroke-width:1.5}.interval{stroke:#2364e8;stroke-width:14;stroke-linecap:round}.median{stroke:#101521;stroke-width:3}.tick,.measure{fill:#343a44;font-size:22px}.measure{font-weight:700}.tick{fill:#555d68}table{width:100%;margin-top:1.1rem;border-collapse:collapse;text-align:left}th,td{padding:.75rem .5rem;border-top:1px solid #e5e6e7}th{color:#454c56}td:last-child{font-variant-numeric:tabular-nums}.sources{margin-top:3rem;padding-top:1rem;border-top:1px solid #d8dadd}a{color:#174dbd;text-underline-offset:.15em}:focus-visible{outline:3px solid #174dbd;outline-offset:3px}@media(max-width:560px){body{padding:1rem}figure,.asset{padding:1rem}table{font-size:.95rem}th,td{padding:.65rem .3rem}}
</style></head><body><main><p class="notice">Private editorial review · Not published · No public route or sitemap entry</p><h1>${esc(draft.title)}</h1><p class="dek">${esc(draft.dek)}</p>${chart}<article>${draft.blocks.map(renderBlock).join("\n")}</article><section class="sources"><h2>Sources and definitions</h2><ul>${sourceList}</ul><p>Values in the figure and table are resolved from approved metric IDs in the pinned analysis record. Analysis SHA-256: <code>${analysisHash}</code>.</p><p>Substantive narrative word count: ${wordCount} (minimum: 500).</p></section></main></body></html>`;
writeFileSync(path.join(root, outputPath), html);
console.log(
  JSON.stringify(
    {
      outputPath,
      analysisHash,
      displayedMetricRefs: metricRefs,
      cohort,
      substantiveWords: wordCount,
    },
    null,
    2,
  ),
);
