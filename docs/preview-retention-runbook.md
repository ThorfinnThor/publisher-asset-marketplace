# Preview retention and R2 garbage collection

## Policy

- Scope: only creator-uploaded objects under `submission-previews/`.
- Retention: at least 90 days after the R2 upload timestamp.
- Confirmation: an object must remain unreferenced for at least 7 days and be observed in more than one scheduled scan.
- References: any matching `assets.preview_url` or `submissions.preview_url` prevents deletion.
- Batch size: at most 100 R2 objects per daily scheduled invocation.
- Default mode: dry-run. `PREVIEW_GC_DELETE_ENABLED` is committed as `false`.
- Exclusions: URL-scanner previews and every other R2 prefix are outside this collector.

The registry in D1 records when an object was first and last observed, when it was last referenced, when it became unreferenced, its earliest deletion time, deletion completion and the latest deletion error.

## Production rollout

1. Deploy migration `0025_preview_object_registry.sql` and the Worker with deletion disabled.
2. Wait until `preview_gc_state.last_completed_at` is non-null. This confirms that a complete R2 prefix scan finished.
3. Keep dry-run active for at least 7 days so that candidates receive a second observation.
4. Review the state and candidate queries below.
5. Change `PREVIEW_GC_DELETE_ENABLED` to `true` in `wrangler.jsonc`, run the full release checks and deploy.
6. Review structured Worker logs for `preview_garbage_collection_completed` or `preview_garbage_collection_failed`.

Do not enable deletion by changing only the Cloudflare dashboard value. The Wrangler configuration is the deployment source of truth.

## Operational queries

```sql
SELECT * FROM preview_gc_state WHERE id = 1;
```

```sql
SELECT
  COUNT(*) AS due_candidates,
  MIN(delete_after) AS oldest_delete_after
FROM preview_object_registry
WHERE deleted_at IS NULL
  AND unreferenced_since IS NOT NULL
  AND delete_after <= datetime('now');
```

```sql
SELECT
  r2_key,
  creator_id,
  uploaded_at,
  unreferenced_since,
  delete_after,
  last_error
FROM preview_object_registry
WHERE deleted_at IS NULL
  AND unreferenced_since IS NOT NULL
ORDER BY delete_after ASC
LIMIT 100;
```

## Emergency stop

Set `PREVIEW_GC_DELETE_ENABLED` back to `false` in `wrangler.jsonc` and deploy. The next scheduled run continues inventory and reference checks but performs no R2 deletion.
