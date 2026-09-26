import { z } from "zod";

import type { EditorialAnalysisOutput } from "./analysis";
import type { EditorialFactPack } from "./fact-pack-schema";

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);

const CitationSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    title: z.string().min(4).max(180),
    publisher: z.string().min(2).max(120),
    url: z.url().refine((value) => value.startsWith("https://"), "citation_url_must_use_https"),
    accessed_at: z.iso.datetime(),
  })
  .strict();

const ProseBlockSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    type: z.literal("prose"),
    text: z.string().min(20).max(1800),
    claim_refs: z.array(z.string()).default([]),
  })
  .strict();

const FindingBlockSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    type: z.literal("finding"),
    heading: z.string().min(3).max(120),
    text: z.string().min(20).max(900),
    claim_refs: z.array(z.string()).min(1),
  })
  .strict();

const MethodBlockSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    type: z.literal("method"),
    heading: z.string().min(3).max(120),
    text: z.string().min(20).max(1200),
    claim_refs: z.array(z.string()).default([]),
  })
  .strict();

const LimitationBlockSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    type: z.literal("limitation"),
    heading: z.string().min(3).max(120),
    text: z.string().min(20).max(1200),
    claim_refs: z.array(z.string()).default([]),
  })
  .strict();

const DataTableBlockSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    type: z.literal("data_table"),
    heading: z.string().min(3).max(140),
    caption: z.string().min(10).max(280),
    columns: z.array(z.string().min(1).max(60)).min(2).max(5),
    rows: z
      .array(
        z
          .object({
            label: z.string().min(1).max(120),
            metric_refs: z.array(z.string()).min(1).max(5),
          })
          .strict(),
      )
      .min(1)
      .max(24),
  })
  .strict();

const AssetLinkBlockSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    type: z.literal("asset_link"),
    asset_slug: z.string().min(1),
    label: z.string().min(3).max(140),
    context: z.string().min(20).max(360),
    claim_refs: z.array(z.string()).default([]),
  })
  .strict();

const ArticleBlockSchema = z.discriminatedUnion("type", [
  ProseBlockSchema,
  FindingBlockSchema,
  MethodBlockSchema,
  LimitationBlockSchema,
  DataTableBlockSchema,
  AssetLinkBlockSchema,
]);

export const EditorialArticleDraftSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    status: z.literal("draft"),
    indexable: z.literal(false),
    language: z.literal("en"),
    format: z.string().min(3).max(60),
    title: z.string().min(20).max(110),
    seo_title: z.string().min(20).max(65),
    seo_description: z.string().min(80).max(170),
    dek: z.string().min(30).max(260),
    thesis: z.string().min(30).max(420),
    metadata_claim_refs: z.array(z.string()).default([]),
    date_created: z.iso.datetime(),
    date_modified: z.iso.datetime(),
    date_published: z.null(),
    brief_id: z.string().regex(/^cb-\d{3}-[a-z0-9-]+$/),
    fact_pack_id: z.string().regex(/^cb-\d{3}-[a-z0-9-]+$/),
    fact_pack_sha256: HashSchema,
    analysis_results_sha256: HashSchema,
    draft_decisions_sha256: HashSchema,
    asset_slugs: z.array(z.string().min(1)).min(1),
    citations: z.array(CitationSchema).min(2),
    blocks: z.array(ArticleBlockSchema).min(7).max(24),
    creator_guide_included: z.literal(false),
  })
  .strict();

export type EditorialArticleDraft = z.infer<typeof EditorialArticleDraftSchema>;

export interface DraftDecision {
  brief_id: string;
  decision: string;
  allowed_metric_ids: string[];
  allowed_metric_prefixes: string[];
  allowed_coverage_refs?: string[];
}

const containsNumeral = (text: string) => /\d/.test(text);

function resolveAllowedReference(
  ref: string,
  decision: DraftDecision,
  pack: EditorialFactPack,
  analysis: EditorialAnalysisOutput["analyses"][number],
) {
  if (
    decision.allowed_coverage_refs?.includes(ref) &&
    ref === "coverage:paired_entity_count" &&
    analysis.coverage?.gate_passed
  ) {
    return null;
  }
  const metric = analysis.metrics.find((entry) => entry.metric_id === ref);
  if (metric) {
    const permitted =
      decision.allowed_metric_ids.includes(ref) ||
      decision.allowed_metric_prefixes.some((prefix) => ref.startsWith(prefix));
    return permitted ? null : `metric_not_approved:${ref}`;
  }
  const fact = pack.facts.find((entry) => entry.fact_id === ref);
  if (!fact) return `fact_or_metric_not_found:${ref}`;
  if (fact.value === null || fact.missing_value) return `fact_not_observed:${ref}`;
  const factIsInApprovedMetric = analysis.metrics.some(
    (entry) =>
      (decision.allowed_metric_ids.includes(entry.metric_id) ||
        decision.allowed_metric_prefixes.some((prefix) => entry.metric_id.startsWith(prefix))) &&
      entry.input_fact_ids.includes(ref),
  );
  if (!factIsInApprovedMetric) return `fact_outside_approved_analysis:${ref}`;
  return null;
}

export function validateEditorialArticleDraft(
  input: unknown,
  context: {
    decision: DraftDecision;
    factPack: EditorialFactPack;
    factPackSha256: string;
    analysis: EditorialAnalysisOutput["analyses"][number];
    analysisResultsSha256: string;
    draftDecisionsSha256: string;
    assetSlugs: string[];
  },
): EditorialArticleDraft {
  const draft = EditorialArticleDraftSchema.parse(input);
  const errors: string[] = [];
  if (context.decision.decision !== "approved_for_scoped_draft") {
    errors.push(`brief_not_approved_for_draft:${draft.brief_id}`);
  }
  if (draft.brief_id !== context.decision.brief_id || draft.fact_pack_id !== context.factPack.id) {
    errors.push("draft_brief_or_fact_pack_mismatch");
  }
  if (context.analysis.brief_id !== draft.brief_id) errors.push("analysis_brief_mismatch");
  if (context.analysis.status !== "calculated_for_sol_review") errors.push("analysis_not_reviewed");
  if (draft.fact_pack_sha256 !== context.factPackSha256) errors.push("fact_pack_checksum_mismatch");
  if (draft.analysis_results_sha256 !== context.analysisResultsSha256) {
    errors.push("analysis_checksum_mismatch");
  }
  if (draft.draft_decisions_sha256 !== context.draftDecisionsSha256) {
    errors.push("draft_decisions_checksum_mismatch");
  }
  if (
    draft.asset_slugs.length !== context.assetSlugs.length ||
    new Set(draft.asset_slugs).size !== draft.asset_slugs.length ||
    draft.asset_slugs.some((slug) => !context.assetSlugs.includes(slug))
  ) {
    errors.push("draft_asset_scope_mismatch");
  }

  const citationIds = new Set(draft.citations.map((citation) => citation.id));
  if (citationIds.size !== draft.citations.length) errors.push("duplicate_citation_id");
  const citedUrls = new Set(draft.citations.map((citation) => citation.url));
  for (const asset of context.factPack.input_assets) {
    if (!citedUrls.has(asset.evidence_url))
      errors.push(`missing_asset_source_citation:${asset.slug}`);
  }
  const blockIds = draft.blocks.map((block) => block.id);
  if (new Set(blockIds).size !== blockIds.length) errors.push("duplicate_article_block_id");

  const metadataText = [
    draft.title,
    draft.seo_title,
    draft.seo_description,
    draft.dek,
    draft.thesis,
  ];
  if (metadataText.some(containsNumeral) && draft.metadata_claim_refs.length === 0) {
    errors.push("numeric_metadata_requires_claim_reference");
  }

  const refsForBlock = (block: (typeof draft.blocks)[number]) =>
    block.type === "data_table" ? block.rows.flatMap((row) => row.metric_refs) : block.claim_refs;

  for (const block of draft.blocks) {
    const visibleText =
      block.type === "data_table"
        ? [block.heading, block.caption, ...block.columns, ...block.rows.map((row) => row.label)]
        : block.type === "finding" || block.type === "method" || block.type === "limitation"
          ? [block.heading, block.text]
          : block.type === "asset_link"
            ? [block.label, block.context]
            : [block.text];
    const refs = refsForBlock(block);
    if (visibleText.some(containsNumeral) && refs.length === 0) {
      errors.push(`numeric_block_requires_claim_reference:${block.id}`);
    }
    for (const ref of refs) {
      const error = resolveAllowedReference(
        ref,
        context.decision,
        context.factPack,
        context.analysis,
      );
      if (error) errors.push(`${block.id}:${error}`);
    }
  }

  for (const ref of draft.metadata_claim_refs) {
    const error = resolveAllowedReference(
      ref,
      context.decision,
      context.factPack,
      context.analysis,
    );
    if (error) errors.push(`metadata:${error}`);
  }
  if (errors.length > 0) throw new Error(`article_draft_validation_failed:${errors.join(";")}`);
  return draft;
}
