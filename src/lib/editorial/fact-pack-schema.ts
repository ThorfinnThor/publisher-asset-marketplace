import { z } from "zod";

const rightsValue = z.enum(["Allowed", "Not allowed", "Unknown"]);

export const EditorialInputAssetSchema = z
  .object({
    asset_id: z.string().nullable(),
    asset_id_resolution: z.enum(["resolved", "public_route_only"]),
    slug: z.string().min(1),
    source_id: z.string().min(1),
    canonical_url: z.url(),
    evidence_url: z.url(),
    evidence_checked_at: z.iso.datetime(),
    licence_code: z.string().nullable(),
    commercial_use: rightsValue,
    modification_allowed: rightsValue,
    raw_data_redistribution: rightsValue,
    attribution_required: z.boolean(),
  })
  .strict();

export const EditorialSourceRequestSchema = z
  .object({
    url: z.url(),
    final_url: z.url(),
    parameters: z.record(z.string(), z.string()),
    http_status: z.number().int().min(200).max(299),
    content_type: z.string().min(1),
    response_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    retrieved_at: z.iso.datetime(),
    snapshot_path: z.string().min(1),
    parser_version: z.string().min(1),
  })
  .strict();

export const EditorialFactSchema = z
  .object({
    fact_id: z.string().min(1),
    value: z.number().finite().nullable(),
    unit: z.string().min(1),
    geography: z
      .object({
        name: z.string().min(1),
        code: z.string().nullable(),
        classification: z.literal("source_entity_unclassified"),
      })
      .strict(),
    period: z.string().min(1),
    frequency: z.string().nullable(),
    status_quality_flag: z.string(),
    missing_value: z.boolean(),
    source_row_reference: z.string().min(1),
    dimensions: z.record(z.string(), z.string()),
  })
  .strict();

export const EditorialFactPackSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    id: z.string().min(1),
    topic: z.string().min(1),
    generated_at: z.iso.datetime(),
    source_fetched_at: z.iso.datetime(),
    method_version: z.string().min(1),
    brief_revision: z.string().min(1),
    scope_note: z.string().nullable(),
    status: z.literal("ready_for_sol_review"),
    input_assets: z.array(EditorialInputAssetSchema).min(1),
    source_requests: z.array(EditorialSourceRequestSchema).min(1),
    facts: z.array(EditorialFactSchema).min(1),
    derived_facts: z.array(z.never()),
    source_status_labels: z.record(z.string(), z.string()),
    caveats: z.array(z.string()),
    source_provenance: z.array(
      z
        .object({
          source_metadata_url: z.url(),
          origin_name: z.string().min(1),
          origin_url: z.url(),
          license_name: z.string().min(1),
          license_url: z.url(),
          non_redistributable: z.literal(false),
          metadata_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict(),
    ),
  })
  .strict();

export const EditorialGenerationStatusSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    generated_at: z.iso.datetime(),
    step: z.literal(4),
    production_writes: z.literal(false),
    source_mode: z.enum(["live_https", "verified_snapshots"]),
    entries: z.array(
      z
        .object({
          brief_id: z.string().min(1),
          candidate_id: z.string().min(1),
          status: z.enum([
            "ready_for_sol_review",
            "blocked_tls",
            "blocked_rights",
            "blocked_source",
          ]),
          fact_pack_path: z.string().nullable(),
          error_code: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export const CreatorVerificationPackSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    id: z.string().min(1),
    candidate_id: z.string().min(1),
    generated_at: z.iso.datetime(),
    status: z.literal("checklist_prepared"),
    factual_outputs_used: z.literal(false),
    assets: z.array(
      z
        .object({
          asset_slug: z.string().min(1),
          marketplace_url: z.url(),
          creator_url: z.url(),
          rights_evidence_url: z.url(),
          rights_status_from_reviewed_candidate: z.record(z.string(), z.array(z.string())),
        })
        .strict(),
    ),
    checks: z.array(
      z
        .object({
          check_id: z.string().min(1),
          state: z.enum(["prepared", "not_run", "passed", "failed"]),
          evidence: z.string().min(1),
        })
        .strict(),
    ),
    publication_effect: z.literal("none"),
  })
  .strict();

export type EditorialFactPack = z.infer<typeof EditorialFactPackSchema>;
