import { z } from "zod";

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const SourceFileSchema = z
  .object({
    kind: z.enum(["data", "metadata"]),
    url: z.url().refine((value) => value.startsWith("https://")),
    sha256: HashSchema,
    storage: z.enum(["hash_only_due_rights", "repository_snapshot"]),
    snapshot_path: z
      .string()
      .regex(/^data\/editorial\/source-snapshots\/[a-z0-9/_\-.]+$/)
      .optional(),
  })
  .strict()
  .superRefine((file, context) => {
    if (file.storage === "repository_snapshot" && !file.snapshot_path) {
      context.addIssue({
        code: "custom",
        message: "repository snapshots require snapshot_path",
        path: ["snapshot_path"],
      });
    }
    if (file.storage === "hash_only_due_rights" && file.snapshot_path) {
      context.addIssue({
        code: "custom",
        message: "hash-only sources must not include a repository snapshot",
        path: ["snapshot_path"],
      });
    }
  });

const SeriesSchema = z
  .object({
    id: z.string().min(2),
    label: z.string().min(4),
    first_year: z.number().int(),
    last_year: z.number().int(),
    observation_count: z.number().int().positive(),
    asserted_values: z
      .array(
        z
          .object({
            year: z.number().int(),
            value: z.number().finite(),
          })
          .strict(),
      )
      .min(1),
    asserted_missing_years: z.array(z.number().int()),
  })
  .strict()
  .superRefine((series, context) => {
    if (series.first_year > series.last_year) {
      context.addIssue({ code: "custom", message: "invalid series time boundary" });
    }
    for (const assertion of series.asserted_values) {
      if (assertion.year < series.first_year || assertion.year > series.last_year) {
        context.addIssue({
          code: "custom",
          message: "asserted value falls outside the approved series boundary",
          path: ["asserted_values"],
        });
      }
    }
  });

const DerivedAssertionSchema = z
  .object({
    id: z.string().min(4),
    operation: z.literal("percentage_decrease"),
    start_year: z.number().int(),
    end_year: z.number().int(),
    expected_unrounded: z.number().finite(),
    display_decimals: z.number().int().min(0).max(6),
    expected_display: z.string().regex(/^-?\d+(?:\.\d+)?%$/),
  })
  .strict();

const ExcludedObservationSchema = z
  .object({
    series_id: z.string().min(2),
    year: z.number().int(),
    value: z.number().finite(),
    status: z.string().min(1),
  })
  .strict();

export const SourceAssertionFixtureSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    asset_id: z.string().min(4),
    asset_slug: z.string().regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
    source_family: z.enum(["owid", "eurostat"]),
    source_updated_at: z.string().min(4),
    source_files: z.array(SourceFileSchema).min(1),
    source_schema: z
      .object({
        format: z.enum(["csv", "json-stat2"]),
        signature: z.array(z.string().min(1)).min(4),
      })
      .strict(),
    scope: z
      .object({
        entity: z.string().min(2),
        entity_code: z.string().min(2),
        unit: z.string().min(2),
        approved_start_year: z.number().int(),
        approved_end_year: z.number().int(),
      })
      .strict(),
    series: z.array(SeriesSchema).min(1),
    derived_assertions: z.array(DerivedAssertionSchema).optional(),
    excluded_observations: z.array(ExcludedObservationSchema).optional(),
    rights_boundary: z
      .object({
        raw_data_redistribution: z.enum([
          "not_approved",
          "allowed_with_attribution_and_policy_exceptions",
        ]),
        repository_payload: z.enum([
          "minimal_reviewed_assertions_only",
          "approved_repository_snapshot",
        ]),
      })
      .strict(),
    presentation_contract: z
      .object({
        preview: z.enum(["source_hosted_chart", "d1_imported_source_table"]),
        embed: z.enum(["source_hosted", "marketplace_rendered"]),
        source_match: z.enum([
          "source_updated_at_and_source_file_hashes",
          "source_updated_at_and_repository_snapshot_hash",
        ]),
      })
      .strict(),
  })
  .strict()
  .superRefine((fixture, context) => {
    if (fixture.scope.approved_start_year > fixture.scope.approved_end_year) {
      context.addIssue({ code: "custom", message: "invalid approved time boundary" });
    }
    if (
      fixture.rights_boundary.raw_data_redistribution === "not_approved" &&
      fixture.source_files.some((source) => source.storage === "repository_snapshot")
    ) {
      context.addIssue({
        code: "custom",
        message: "non-redistributable source data cannot be stored as a repository snapshot",
        path: ["source_files"],
      });
    }
  });

export type SourceAssertionFixture = z.infer<typeof SourceAssertionFixtureSchema>;

export function percentageDecrease(start: number, end: number): number {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) {
    throw new Error("percentage_decrease_requires_finite_nonzero_start");
  }
  return ((start - end) / start) * 100;
}

export function formatPercent(value: number, decimals: number): string {
  if (!Number.isFinite(value) || !Number.isInteger(decimals) || decimals < 0 || decimals > 6) {
    throw new Error("invalid_percentage_display_parameters");
  }
  return `${value.toFixed(decimals)}%`;
}
