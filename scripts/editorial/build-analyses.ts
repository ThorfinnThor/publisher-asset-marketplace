import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import prettier from "prettier";

import {
  AnalysisDecisionFile,
  buildEditorialAnalyses,
  canonicalJsonSha256,
  GeographyOverrides,
  GeographyReference,
} from "../../src/lib/editorial/analysis";
import { EditorialFactPackSchema } from "../../src/lib/editorial/fact-pack-schema";

const root = process.cwd();
const readJson = <T>(relativePath: string): { data: T; bytes: Buffer } => {
  const bytes = readFileSync(path.join(root, relativePath));
  return { data: JSON.parse(bytes.toString("utf8")) as T, bytes };
};

const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

const decisionsFile = readJson<AnalysisDecisionFile>("data/editorial/analysis-decisions.json");
const referenceFile = readJson<GeographyReference>(
  "data/editorial/reference/un-m49-country-areas.json",
);
const overridesFile = readJson<GeographyOverrides>(
  "data/editorial/reference/cb-001-geography-overrides.json",
);
const expectedReferenceEntryHash = canonicalJsonSha256(referenceFile.data.entries);
if (expectedReferenceEntryHash !== referenceFile.data.entries_sha256) {
  throw new Error("m49_reference_entries_hash_mismatch");
}
if (referenceFile.data.entries.length !== referenceFile.data.entry_count) {
  throw new Error("m49_reference_entry_count_mismatch");
}

const briefIds = [
  "cb-001-internet-adoption-gap",
  "cb-002-eu-renewable-share-patterns",
  "cb-003-hicp-inflation-explainer",
  "cb-004-wildfire-land-cover",
];
const factPacks: Record<string, ReturnType<typeof EditorialFactPackSchema.parse>> = {};
const packSha256ById: Record<string, string> = {};
let snapshotCount = 0;

for (const briefId of briefIds) {
  const relativePackPath = `data/editorial/fact-packs/${briefId}.json`;
  const loaded = readJson<unknown>(relativePackPath);
  const pack = EditorialFactPackSchema.parse(loaded.data);
  if (pack.id !== briefId) throw new Error(`fact_pack_id_mismatch:${briefId}`);
  factPacks[briefId] = pack;
  packSha256ById[briefId] = sha256(loaded.bytes);

  for (const request of pack.source_requests) {
    const snapshotPath = path.resolve(root, request.snapshot_path);
    const expectedPrefix = path.resolve(root, "data/editorial/source-snapshots") + path.sep;
    if (!snapshotPath.startsWith(expectedPrefix)) {
      throw new Error(`source_snapshot_path_outside_allowlist:${request.snapshot_path}`);
    }
    const snapshot = readFileSync(snapshotPath);
    if (sha256(snapshot) !== request.response_sha256) {
      throw new Error(`source_snapshot_sha256_mismatch:${request.snapshot_path}`);
    }
    snapshotCount += 1;
  }
}

const result = buildEditorialAnalyses({
  factPacks,
  decisions: decisionsFile.data,
  decisionFileSha256: sha256(decisionsFile.bytes),
  reference: referenceFile.data,
  overrides: overridesFile.data,
  packSha256ById,
});

const outputPath = path.join(root, "data/editorial/analysis-results.json");
const prettierOptions = await prettier.resolveConfig(outputPath);
const formatted = await prettier.format(JSON.stringify(result), {
  ...prettierOptions,
  filepath: outputPath,
  parser: "json",
});
writeFileSync(outputPath, formatted, "utf8");

console.log(
  JSON.stringify(
    {
      output: path.relative(root, outputPath),
      verifiedSourceSnapshots: snapshotCount,
      analyses: result.analyses.map((analysis) => ({
        brief_id: analysis.brief_id,
        status: analysis.status,
        metrics: analysis.metrics.length,
        pairedEntities: analysis.coverage?.paired_entity_count,
      })),
    },
    null,
    2,
  ),
);
