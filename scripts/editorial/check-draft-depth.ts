import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const minimum = 500;
const decisions = JSON.parse(
  readFileSync(path.join(root, "data/editorial/private-rendered-review-decisions.json"), "utf8"),
) as { decisions: { brief_id: string; decision: string }[] };
const directory = "content/editorial/drafts";
const reports: { briefId: string; words: number; status: string }[] = [];
let failed = false;

for (const file of readdirSync(path.join(root, directory)).filter((name) =>
  name.endsWith(".json"),
)) {
  const draft = JSON.parse(readFileSync(path.join(root, directory, file), "utf8")) as {
    brief_id: string;
    blocks: { id: string; type: string; text?: string }[];
  };
  const prior = decisions.decisions.find((entry) => entry.brief_id === draft.brief_id);
  const words = draft.blocks
    .filter(
      (block) =>
        ["prose", "finding", "method", "limitation"].includes(block.type) &&
        !["reuse-note", "attribution"].includes(block.id),
    )
    .reduce(
      (total, block) =>
        total + ((block.text ?? "").match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).length,
      0,
    );
  if (prior?.decision === "hold_source_lineage_unresolved") {
    reports.push({ briefId: draft.brief_id, words, status: "held_source_lineage" });
  } else if (words < minimum) {
    reports.push({ briefId: draft.brief_id, words, status: "fail_minimum" });
    failed = true;
  } else {
    reports.push({ briefId: draft.brief_id, words, status: "pass_minimum_human_review_required" });
  }
}

console.log(JSON.stringify({ minimumSubstantiveWords: minimum, drafts: reports }, null, 2));
if (failed) process.exitCode = 1;
