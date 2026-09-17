import { describe, expect, it } from "vitest";

import {
  creatorAssetUpdateDuplicateSql,
  creatorAssetUpdateLookupSql,
  preserveCreatorAssetIdentity,
} from "../src/lib/assets/update-creator-asset";
import type { CreatorAssetRecord } from "../src/lib/assets/publish-submission";

const generatedAsset: CreatorAssetRecord = {
  id: "asset-generated",
  creator_id: "github:123",
  slug: "creator-new-title-generated",
  asset_type: "calculator",
  title: "Updated calculator",
  description: "An updated calculator description for publisher use.",
  canonical_url: "https://example.com/calculator",
  canonical_url_normalized: "https://example.com/calculator",
  embed_url: "https://example.com/embed/calculator",
  embed_origin: "https://example.com",
  preview_url: "https://example.com/preview.png",
  citation_text: "Source: Example. Updated calculator. https://example.com/calculator",
  attribution_name: "Example",
  attribution_url: "https://example.com/rights",
  attribution_terms: "Credit Example",
  rights_status: "restricted",
  rights_json: "{}",
  metadata_json: "{}",
  search_document: "Updated calculator",
  created_at: "2026-09-17T10:00:00.000Z",
  updated_at: "2026-09-17T11:00:00.000Z",
  last_checked_at: "2026-09-17T11:00:00.000Z",
};

describe("creator asset updates", () => {
  it("scopes the editable asset lookup to its authenticated creator", () => {
    expect(creatorAssetUpdateLookupSql).toContain("a.slug = ? AND a.creator_id = ?");
    expect(creatorAssetUpdateLookupSql).toContain("a.status = 'published'");
  });

  it("excludes the current asset and submission from duplicate URL checks", () => {
    expect(creatorAssetUpdateDuplicateSql).toContain("canonical_url_normalized = ? AND id <> ?");
    expect(creatorAssetUpdateDuplicateSql.match(/id <> \?/gu)).toHaveLength(2);
  });

  it("keeps the public slug, asset id and original creation time stable", () => {
    const updated = preserveCreatorAssetIdentity(generatedAsset, {
      asset_id: "asset-existing",
      slug: "creator-original-title-existing",
      asset_created_at: "2026-09-16T08:00:00.000Z",
      preview_url: "https://example.com/old-preview.png",
      submission_id: "submission-existing",
    });

    expect(updated).toMatchObject({
      id: "asset-existing",
      slug: "creator-original-title-existing",
      created_at: "2026-09-16T08:00:00.000Z",
      title: "Updated calculator",
    });
  });
});
