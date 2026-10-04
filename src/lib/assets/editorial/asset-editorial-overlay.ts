import { z } from "zod";

import eurostatRenewablesJson from "../../../../content/assets/editorial/eurostat-nrg_ind_ren.json";
import fossilReservesJson from "../../../../content/assets/editorial/years-of-fossil-fuel-reserves-left.json";
import solarPricesJson from "../../../../content/assets/editorial/solar-pv-prices.json";
import eurostatAssertionJson from "../../../../data/seo/source-assertions-v2-06/eurostat-nrg_ind_ren.json";
import fossilAssertionJson from "../../../../data/seo/source-assertions-v2-06/years-of-fossil-fuel-reserves-left.json";
import solarAssertionJson from "../../../../data/seo/source-assertions-v2-06/solar-pv-prices.json";

import type { PublishedAssetDetail } from "../get-asset";
import { SourceAssertionFixtureSchema } from "./source-assertion-fixture";

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const InternalLinkSchema = z
  .object({
    path: z.string().regex(/^\/(?:asset|insights|topics)\/[a-z0-9][a-z0-9/_-]*$/),
    label: z.string().min(4).max(120),
    context: z.string().min(20).max(280),
  })
  .strict();

export const AssetEditorialOverlaySchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    asset_id: z.string().min(4),
    asset_slug: z.string().regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
    content_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    review_state: z.literal("approved"),
    language: z.literal("en"),
    question: z.string().min(20).max(180),
    direct_answer: z.string().min(80).max(900),
    methodology: z.array(z.string().min(40).max(700)).min(1).max(4),
    limitations: z.array(z.string().min(30).max(500)).min(1).max(6),
    observation_coverage: z
      .object({
        unit: z.string().min(2).max(120),
        period: z.string().min(4).max(160),
        geography: z.string().min(2).max(180),
        frequency: z.string().min(2).max(120),
        series_scope: z.string().min(4).max(220),
      })
      .strict(),
    source_contract: z
      .object({
        source_id: z.string().min(4),
        canonical_url: z.url().refine((value) => value.startsWith("https://")),
        expected_source_updated_at: z.string().min(4),
        source_version: z.string().min(4).max(120),
        source_version_label: z.string().min(8).max(180),
        transformation_id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        evidence_sha256: z.array(HashSchema).min(1),
      })
      .strict(),
    related_links: z.array(InternalLinkSchema).max(4),
    review: z
      .object({
        brief_id: z.string().regex(/^ab-\d{3}-[a-z0-9-]+$/),
        reviewer_role: z.literal("Sol"),
        approved_at: z.iso.datetime(),
        evidence_review_sha256: HashSchema,
      })
      .strict(),
  })
  .strict();

export type AssetEditorialOverlay = z.infer<typeof AssetEditorialOverlaySchema>;

export type AssetEditorialOverlayResolution =
  | { status: "approved_fresh"; overlay: AssetEditorialOverlay }
  | { status: "absent" | "stale" | "suppressed"; overlay: null };

const overlayInputs: unknown[] = [fossilReservesJson, solarPricesJson, eurostatRenewablesJson];
const overlayMap = new Map<string, AssetEditorialOverlay>();
const sourceAssertionMap = new Map(
  [fossilAssertionJson, solarAssertionJson, eurostatAssertionJson].map((input) => {
    const fixture = SourceAssertionFixtureSchema.parse(input);
    return [fixture.asset_id, fixture] as const;
  }),
);

for (const input of overlayInputs) {
  const overlay = AssetEditorialOverlaySchema.parse(input);
  if (overlayMap.has(overlay.asset_id)) {
    throw new Error(`duplicate_asset_editorial_overlay:${overlay.asset_id}`);
  }
  overlayMap.set(overlay.asset_id, overlay);
}

export function resolveAssetEditorialOverlay(
  asset: Pick<
    PublishedAssetDetail,
    "canonical_url" | "id" | "rights_status" | "slug" | "source_id" | "source_updated_at"
  >,
): AssetEditorialOverlayResolution {
  const overlay = overlayMap.get(asset.id);
  if (!overlay) return { status: "absent", overlay: null };

  if (
    asset.rights_status !== "safe" ||
    overlay.asset_slug !== asset.slug ||
    overlay.source_contract.source_id !== asset.source_id ||
    normalizeUrl(overlay.source_contract.canonical_url) !== normalizeUrl(asset.canonical_url)
  ) {
    return { status: "suppressed", overlay: null };
  }

  const sourceAssertion = sourceAssertionMap.get(overlay.asset_id);
  if (
    !sourceAssertion ||
    !sameTimestamp(
      sourceAssertion.source_updated_at,
      overlay.source_contract.expected_source_updated_at,
    ) ||
    !sourceAssertion.source_files.every((sourceFile) =>
      overlay.source_contract.evidence_sha256.includes(sourceFile.sha256),
    )
  ) {
    return { status: "stale", overlay: null };
  }

  if (!sameTimestamp(overlay.source_contract.expected_source_updated_at, asset.source_updated_at)) {
    return { status: "stale", overlay: null };
  }

  return { status: "approved_fresh", overlay };
}

export function configuredAssetEditorialOverlays(): readonly AssetEditorialOverlay[] {
  return [...overlayMap.values()];
}

function normalizeUrl(value: string): string | null {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function sameTimestamp(expected: string, actual: string | null): boolean {
  if (!actual) return false;
  const expectedTime = Date.parse(expected);
  const actualTime = Date.parse(actual);
  return !Number.isNaN(expectedTime) && !Number.isNaN(actualTime) && expectedTime === actualTime;
}
