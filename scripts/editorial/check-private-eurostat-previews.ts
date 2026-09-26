import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(path.join(root, "data/editorial/private-eurostat-preview-manifest.json"), "utf8"),
) as {
  analysis_results_sha256: string;
  previews: {
    brief_id: string;
    draft_path: string;
    preview_path: string;
    preview_sha256: string;
  }[];
};
const analysis = readFileSync(path.join(root, "data/editorial/analysis-results.json"));
const analysisHash = createHash("sha256").update(analysis).digest("hex");
if (analysisHash !== manifest.analysis_results_sha256) throw new Error("analysis_hash_mismatch");
const analysisFile = JSON.parse(analysis.toString("utf8")) as {
  analyses: { brief_id: string; metrics: { metric_id: string }[] }[];
};
const requiredCitations: Record<string, string[]> = {
  "cb-002-eu-renewable-share-patterns": [
    "eurostat-transport-2024",
    "eurostat-renewable-heating-2024",
  ],
  "cb-003-hicp-inflation-explainer": ["eurostat-hicp-dataset-mapping"],
};
const expectedAdjacency: Record<string, Record<string, string>> = {
  "cb-002-eu-renewable-share-patterns": {
    "transport-scope": "eurostat-transport-2024",
    "heating-cooling-scope": "eurostat-renewable-heating-2024",
  },
  "cb-003-hicp-inflation-explainer": {
    "how-the-annual-average-works": "eurostat-hicp-table",
    "rate-vs-index": "eurostat-hicp-methodology",
    classification: "eurostat-hicp-dataset-mapping",
  },
};

const checks = manifest.previews.map(({ brief_id, draft_path, preview_path, preview_sha256 }) => {
  const html = readFileSync(path.join(root, preview_path), "utf8");
  const draft = JSON.parse(readFileSync(path.join(root, draft_path), "utf8")) as {
    brief_id: string;
    citations: { id: string; url: string }[];
  };
  const actualHash = createHash("sha256").update(html).digest("hex");
  if (actualHash !== preview_sha256) throw new Error(`preview_hash_mismatch:${preview_path}`);
  if (draft.brief_id !== brief_id) throw new Error(`draft_brief_mismatch:${preview_path}`);
  const analysisEntry = analysisFile.analyses.find((entry) => entry.brief_id === brief_id);
  if (!analysisEntry) throw new Error(`analysis_missing:${brief_id}`);
  const approvedMetricIds = new Set(analysisEntry.metrics.map((metric) => metric.metric_id));
  for (const refs of html.matchAll(/data-metric-refs="([^"]+)"/g)) {
    for (const metricId of refs[1].split(/\s+/)) {
      if (!approvedMetricIds.has(metricId))
        throw new Error(`metric_binding_missing:${brief_id}:${metricId}`);
    }
  }
  for (const citationId of requiredCitations[brief_id] ?? []) {
    const citation = draft.citations.find((entry) => entry.id === citationId);
    if (!citation) throw new Error(`citation_missing_in_draft:${brief_id}:${citationId}`);
    if (!html.includes(`href="${citation.url}"`))
      throw new Error(`citation_not_adjacent_or_rendered:${brief_id}:${citationId}`);
  }
  for (const [blockId, citationId] of Object.entries(expectedAdjacency[brief_id] ?? {})) {
    const blockPattern = new RegExp(
      `<div class="editorial-block" data-block-id="${blockId}" data-citation-ids="([^"]*)">([\\s\\S]*?)</div>`,
    );
    const blockMatch = html.match(blockPattern);
    if (!blockMatch) throw new Error(`editorial_block_missing:${brief_id}:${blockId}`);
    if (blockMatch[1].trim() !== citationId)
      throw new Error(`editorial_block_citation_mismatch:${brief_id}:${blockId}`);
    if (!blockMatch[2].includes(`data-citation-id="${citationId}"`))
      throw new Error(`editorial_block_source_missing:${brief_id}:${blockId}`);
  }
  if (
    brief_id === "cb-002-eu-renewable-share-patterns" &&
    html.includes("red-ii-consolidated-2023")
  ) {
    throw new Error("outdated_renewable_directive_citation_rendered");
  }
  if (brief_id === "cb-003-hicp-inflation-explainer") {
    const points = html.match(/<polyline class="line" points="([^"]+)"/);
    if (!points) throw new Error("hicp_line_missing");
    const xValues = points[1].split(/\s+/).map((point) => Number(point.split(",")[0]));
    if (xValues.some((x) => !Number.isFinite(x) || x < 75 || x > 700))
      throw new Error("hicp_x_domain_inconsistent");
    if (!html.includes('data-y-ticks="0 5 10"')) throw new Error("hicp_y_ticks_missing");
    if ((html.match(/class="point"/g) ?? []).length !== 8) throw new Error("hicp_points_missing");
    if ((html.match(/class="point-value"/g) ?? []).length !== 8)
      throw new Error("hicp_value_labels_missing");
  }
  const result = {
    path: preview_path,
    sha256: actualHash,
    private: html.includes("noindex,nofollow,noarchive"),
    lang: html.includes('<html lang="en">'),
    singleH1: (html.match(/<h1>/g) ?? []).length === 1,
    accessibleSvg: html.includes("aria-labelledby=") && html.includes("<title"),
    equivalentTable: html.includes("<table"),
    adjacentMethodSources: (html.match(/class="method-source"/g) ?? []).length >= 3,
    metricBindings: html.includes("data-metric-refs=") && html.includes("Analysis SHA-256"),
  };
  if (Object.values(result).some((value) => value === false)) {
    throw new Error(`preview_static_check_failed:${preview_path}`);
  }
  return result;
});

console.log(JSON.stringify({ analysisHash, previews: checks }, null, 2));
