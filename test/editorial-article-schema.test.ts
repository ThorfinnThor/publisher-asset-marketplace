import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  validateEditorialArticleDraft,
  type DraftDecision,
} from "../src/lib/editorial/article-schema";
import type { EditorialAnalysisOutput } from "../src/lib/editorial/analysis";
import {
  EditorialFactPackSchema,
  type EditorialFactPack,
} from "../src/lib/editorial/fact-pack-schema";

const bytes = (relativePath: string) => readFileSync(relativePath);
const json = <T>(relativePath: string): T => JSON.parse(bytes(relativePath).toString("utf8")) as T;
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const resultBytes = bytes("data/editorial/analysis-results.json");
const analysisResultsSha256 = sha256(resultBytes);
const results = JSON.parse(resultBytes.toString("utf8")) as EditorialAnalysisOutput;
const decisionBytes = bytes("data/editorial/draft-decisions.json");
const draftDecisionsSha256 = sha256(decisionBytes);
const decisions = json<{ decisions: DraftDecision[] }>(
  "data/editorial/draft-decisions.json",
).decisions;
const draftFiles = readdirSync("content/editorial/drafts").filter((name) => name.endsWith(".json"));

function contextFor(briefId: string) {
  const pack = EditorialFactPackSchema.parse(
    json<unknown>(`data/editorial/fact-packs/${briefId}.json`),
  ) as EditorialFactPack;
  const analysis = results.analyses.find((entry) => entry.brief_id === briefId);
  const decision = decisions.find((entry) => entry.brief_id === briefId);
  if (!analysis || !decision) throw new Error(`missing_test_context:${briefId}`);
  return {
    decision,
    factPack: pack,
    factPackSha256: sha256(bytes(`data/editorial/fact-packs/${briefId}.json`)),
    analysis,
    analysisResultsSha256,
    draftDecisionsSha256,
    assetSlugs: pack.input_assets.map((asset) => asset.slug),
  };
}

describe("private editorial article drafts", () => {
  it("validates every scoped draft against its reviewed facts, decision, and hashes", () => {
    expect(draftFiles).toHaveLength(4);
    for (const file of draftFiles) {
      const draft = json<Record<string, unknown>>(`content/editorial/drafts/${file}`);
      expect(() =>
        validateEditorialArticleDraft(draft, contextFor(String(draft.brief_id))),
      ).not.toThrow();
      expect(draft.status).toBe("draft");
      expect(draft.indexable).toBe(false);
      expect(draft.date_published).toBeNull();
    }
  });

  it("rejects indexable or published content", () => {
    const draft = json<Record<string, unknown>>(`content/editorial/drafts/${draftFiles[0]}`);
    const context = contextFor(String(draft.brief_id));
    expect(() => validateEditorialArticleDraft({ ...draft, indexable: true }, context)).toThrow();
    expect(() =>
      validateEditorialArticleDraft({ ...draft, status: "published" }, context),
    ).toThrow();
  });

  it("rejects unapproved metrics and numerical text without claim references", () => {
    const file = draftFiles.find((name) => name.includes("renewables"));
    if (!file) throw new Error("missing_renewables_test_draft");
    const draft = json<Record<string, unknown>>(`content/editorial/drafts/${file}`);
    const context = contextFor(String(draft.brief_id));
    context.decision.allowed_metric_ids = context.decision.allowed_metric_ids.filter(
      (metricId) => metricId !== "renewable:2024:REN",
    );
    const blocks = structuredClone(draft.blocks) as Array<Record<string, unknown>>;
    const table = blocks.find((block) => block.type === "data_table");
    if (!table) throw new Error("missing_renewables_test_table");
    const rows = table.rows as Array<Record<string, unknown>>;
    rows[0]!.metric_refs = ["renewable:2024:REN"];
    expect(() => validateEditorialArticleDraft({ ...draft, blocks }, context)).toThrow(
      "metric_not_approved",
    );

    const proseBlocks = structuredClone(draft.blocks) as Array<Record<string, unknown>>;
    const prose = proseBlocks.find((block) => block.type === "prose");
    if (!prose) throw new Error("missing_renewables_test_prose");
    prose.text = `${String(prose.text)} In 2024 this comparison was published.`;
    expect(() => validateEditorialArticleDraft({ ...draft, blocks: proseBlocks }, context)).toThrow(
      "numeric_block_requires_claim_reference",
    );
  });

  it("rejects out-of-scope assets and stale decision checksums", () => {
    const draft = json<Record<string, unknown>>(`content/editorial/drafts/${draftFiles[0]}`);
    const context = contextFor(String(draft.brief_id));
    expect(() =>
      validateEditorialArticleDraft({ ...draft, asset_slugs: ["unreviewed-asset"] }, context),
    ).toThrow("draft_asset_scope_mismatch");
    expect(() =>
      validateEditorialArticleDraft({ ...draft, draft_decisions_sha256: "0".repeat(64) }, context),
    ).toThrow("draft_decisions_checksum_mismatch");
  });

  it("rejects source facts outside the approved analysis and missing source citations", () => {
    const file = draftFiles.find((name) => name.includes("world-burned-area"));
    if (!file) throw new Error("missing_wildfire_test_draft");
    const draft = json<Record<string, unknown>>(`content/editorial/drafts/${file}`);
    const context = contextFor(String(draft.brief_id));
    const otherCountryFact = context.factPack.facts.find(
      (fact) => fact.geography.code !== "OWID_WRL" && fact.value !== null,
    );
    if (!otherCountryFact) throw new Error("missing_country_fact_for_scope_test");
    const blocks = structuredClone(draft.blocks) as Array<Record<string, unknown>>;
    const finding = blocks.find((block) => block.type === "finding");
    if (!finding) throw new Error("missing_wildfire_test_finding");
    finding.claim_refs = [otherCountryFact.fact_id];
    expect(() => validateEditorialArticleDraft({ ...draft, blocks }, context)).toThrow(
      "fact_outside_approved_analysis",
    );

    const citations = structuredClone(draft.citations) as Array<Record<string, unknown>>;
    const sourceCitation = citations.find(
      (citation) => citation.url === context.factPack.input_assets[0]?.evidence_url,
    );
    if (!sourceCitation) throw new Error("missing_source_citation_for_test");
    sourceCitation.url = "https://example.org/unrelated-source";
    expect(() => validateEditorialArticleDraft({ ...draft, citations }, context)).toThrow(
      "missing_asset_source_citation",
    );
  });
});
