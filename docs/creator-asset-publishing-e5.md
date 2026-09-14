# E5 approved creator asset publishing

E5 promotes an approved creator submission into the shared `assets` index. The promotion is part of
the admin review batch: the asset upsert, submission state change, `asset_id` link and review audit
row succeed together or are rolled back together.

## Public asset contract

An approved submission becomes `assets.status = 'published'` with:

- `creator_id` set and `source_id` left null;
- the reviewed title, description, attribution name and attribution terms;
- a deterministic human-readable slug with a submission-id suffix;
- a citation generated from the reviewed attribution and canonical URL;
- `rights_status` limited to `safe` or `restricted`;
- reviewed rights evidence in `rights_json` and `metadata_json`;
- a normalized `embed_origin` snapshot.

Creator assets use the same FTS and trigram search tables as seeded source assets. Search labels use
the creator's reviewed attribution name when no source record exists.

## Embed boundary

The promotion revalidates the stored canonical, embed, preview, attribution and evidence URLs as
public HTTPS URLs without fetching them. Public embed copy requires the reviewed `embed_allowed`
flag and an exact HTTPS origin match against `assets.embed_origin`. Generated markup escapes the URL
and title and includes a restrictive sandbox, lazy loading and a strict referrer policy. Creator
markup also includes the visible, reviewed source/brand attribution defined by E6.

## Implementation

- Migration: `migrations/0009_creator_asset_publishing.sql`, `migrations/0010_creator_attribution_terms.sql`
- Promotion contract: `src/lib/assets/publish-submission.ts`
- Admin transaction: `src/app/api/admin/submissions/[id]/review/route.ts`
- Shared search/detail/embed paths updated for creator assets
- Tests: `test/publish-asset.test.ts`, `test/embed.test.ts`
