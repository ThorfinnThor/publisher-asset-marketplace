import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  validateEditorialArticleDraft,
  type DraftDecision,
} from "../../src/lib/editorial/article-schema";
import type { EditorialAnalysisOutput } from "../../src/lib/editorial/analysis";
import { EditorialFactPackSchema } from "../../src/lib/editorial/fact-pack-schema";

const root = process.cwd();
const readBytes = (relativePath: string) => readFileSync(path.join(root, relativePath));
const readJson = <T>(relativePath: string) =>
  JSON.parse(readBytes(relativePath).toString("utf8")) as T;
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

const resultBytes = readBytes("data/editorial/analysis-results.json");
const analysisResultsSha256 = sha256(resultBytes);
const result = JSON.parse(resultBytes.toString("utf8")) as EditorialAnalysisOutput;
const decisionsBytes = readBytes("data/editorial/draft-decisions.json");
const draftDecisionsSha256 = sha256(decisionsBytes);
const decisionFile = JSON.parse(decisionsBytes.toString("utf8")) as {
  step: number;
  analysis_results_sha256: string;
  decisions: DraftDecision[];
};

if (decisionFile.step !== 9 || decisionFile.analysis_results_sha256 !== analysisResultsSha256) {
  throw new Error("draft_decision_file_does_not_match_reviewed_analysis");
}

const draftsDirectory = "content/editorial/drafts";
const draftFiles = readdirSync(path.join(root, draftsDirectory)).filter((name) =>
  name.endsWith(".json"),
);
const approved = decisionFile.decisions.filter(
  (decision) => decision.decision === "approved_for_scoped_draft",
);
if (draftFiles.length !== approved.length) {
  throw new Error(
    `draft_count_does_not_match_approved_briefs:${draftFiles.length}:${approved.length}`,
  );
}

const validated: string[] = [];
for (const fileName of draftFiles) {
  const relativePath = `${draftsDirectory}/${fileName}`;
  const input = readJson<unknown>(relativePath);
  const briefId = (input as { brief_id?: string }).brief_id;
  const decision = decisionFile.decisions.find((entry) => entry.brief_id === briefId);
  if (!decision) throw new Error(`draft_decision_missing:${relativePath}`);

  const factPackPath = `data/editorial/fact-packs/${briefId}.json`;
  const factPack = EditorialFactPackSchema.parse(readJson<unknown>(factPackPath));
  const factPackSha256 = sha256(readBytes(factPackPath));
  const analysis = result.analyses.find((entry) => entry.brief_id === briefId);
  if (!analysis) throw new Error(`draft_analysis_missing:${briefId}`);

  const draft = validateEditorialArticleDraft(input, {
    decision,
    factPack,
    factPackSha256,
    analysis,
    analysisResultsSha256,
    draftDecisionsSha256,
    assetSlugs: factPack.input_assets.map((asset) => asset.slug),
  });
  if (fileName !== `${draft.slug}.json`)
    throw new Error(`draft_filename_slug_mismatch:${relativePath}`);
  validated.push(draft.slug);
}

const draftedBriefs = new Set(
  validated.map((slug) => {
    const input = readJson<{ brief_id: string }>(`${draftsDirectory}/${slug}.json`);
    return input.brief_id;
  }),
);
if (
  draftedBriefs.size !== approved.length ||
  approved.some((entry) => !draftedBriefs.has(entry.brief_id))
) {
  throw new Error("approved_draft_coverage_mismatch");
}

console.log(
  JSON.stringify({ validatedDrafts: validated.sort(), status: "private_non_indexable" }, null, 2),
);
