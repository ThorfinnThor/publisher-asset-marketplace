const previewPrefix = "submission-previews/";
const millisecondsPerDay = 24 * 60 * 60 * 1000;

export type PreviewGarbageCollectionConfig = {
  deleteEnabled: boolean;
  retentionDays: number;
  confirmationDays: number;
  maxObjects: number;
};

export type PreviewObjectInventory = {
  r2Key: string;
  creatorId: string | null;
  uploadedAt: string;
};

export type PreviewRegistrySnapshot = {
  r2_key: string;
  unreferenced_since: string | null;
  deleted_at: string | null;
};

export type PreviewGarbageCollectionPlan = {
  observations: Array<{
    object: PreviewObjectInventory;
    referenced: boolean;
    unreferencedSince: string | null;
    deleteAfter: string | null;
  }>;
  deletionCandidates: string[];
};

export type PreviewGarbageCollectionResult = {
  scanned: number;
  referenced: number;
  candidates: number;
  deleted: number;
  deletionEnabled: boolean;
  scanCompleted: boolean;
};

type PreviewGarbageCollectionInput = PreviewGarbageCollectionConfig & {
  now: string;
};

type PreviewGcStateRow = {
  cursor: string | null;
};

export function previewGarbageCollectionConfig(env: {
  PREVIEW_GC_DELETE_ENABLED?: string;
  PREVIEW_GC_RETENTION_DAYS?: string;
  PREVIEW_GC_CONFIRMATION_DAYS?: string;
}): PreviewGarbageCollectionConfig {
  return {
    deleteEnabled: env.PREVIEW_GC_DELETE_ENABLED === "true",
    retentionDays: boundedInteger(env.PREVIEW_GC_RETENTION_DAYS, 90, 30, 3650),
    confirmationDays: boundedInteger(env.PREVIEW_GC_CONFIRMATION_DAYS, 7, 1, 30),
    maxObjects: 100,
  };
}

export async function registerPreviewUpload(
  db: D1Database,
  input: { r2Key: string; creatorId: string; uploadedAt: string },
): Promise<void> {
  if (!input.r2Key.startsWith(previewPrefix)) {
    throw new Error("Preview registry only accepts submission preview objects.");
  }
  await db
    .prepare(
      `
        INSERT INTO preview_object_registry (
          r2_key,
          creator_id,
          uploaded_at,
          first_seen_at,
          last_seen_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(r2_key) DO UPDATE SET
          creator_id = excluded.creator_id,
          uploaded_at = excluded.uploaded_at,
          last_seen_at = excluded.last_seen_at,
          deleted_at = NULL,
          last_error = NULL,
          updated_at = excluded.updated_at
      `,
    )
    .bind(
      input.r2Key,
      input.creatorId,
      input.uploadedAt,
      input.uploadedAt,
      input.uploadedAt,
      input.uploadedAt,
    )
    .run();
}

export function buildPreviewGarbageCollectionPlan(
  objects: PreviewObjectInventory[],
  registry: Map<string, PreviewRegistrySnapshot>,
  referencedKeys: Set<string>,
  input: PreviewGarbageCollectionInput,
): PreviewGarbageCollectionPlan {
  const nowMs = parseTimestamp(input.now, "now");
  const observations: PreviewGarbageCollectionPlan["observations"] = [];
  const deletionCandidates: string[] = [];

  for (const object of objects) {
    const uploadedMs = parseTimestamp(object.uploadedAt, `uploadedAt for ${object.r2Key}`);
    const existing = registry.get(object.r2Key);
    const referenced = referencedKeys.has(object.r2Key);
    const unreferencedSince = referenced ? null : (existing?.unreferenced_since ?? input.now);
    const deleteAfter = referenced
      ? null
      : new Date(
          Math.max(
            uploadedMs + input.retentionDays * millisecondsPerDay,
            parseTimestamp(
              unreferencedSince ?? input.now,
              `unreferencedSince for ${object.r2Key}`,
            ) +
              input.confirmationDays * millisecondsPerDay,
          ),
        ).toISOString();

    observations.push({ object, referenced, unreferencedSince, deleteAfter });
    if (
      existing?.unreferenced_since &&
      !existing.deleted_at &&
      deleteAfter &&
      nowMs >= Date.parse(deleteAfter)
    ) {
      deletionCandidates.push(object.r2Key);
    }
  }

  return { observations, deletionCandidates };
}

export async function runPreviewGarbageCollection(
  db: D1Database,
  bucket: R2Bucket,
  input: PreviewGarbageCollectionInput,
): Promise<PreviewGarbageCollectionResult> {
  parseTimestamp(input.now, "now");
  const state = await db
    .prepare("SELECT cursor FROM preview_gc_state WHERE id = 1")
    .first<PreviewGcStateRow>();
  if (!state) throw new Error("Preview garbage-collection state is missing.");

  const listed = await bucket.list({
    prefix: previewPrefix,
    limit: input.maxObjects,
    cursor: state.cursor ?? undefined,
    include: ["customMetadata"],
  });
  const objects: PreviewObjectInventory[] = listed.objects.map((object) => ({
    r2Key: object.key,
    creatorId: object.customMetadata?.creatorId ?? null,
    uploadedAt: object.uploaded.toISOString(),
  }));
  const keys = objects.map((object) => object.r2Key);
  const [registry, referencedKeys] = await Promise.all([
    loadRegistrySnapshots(db, keys),
    loadReferencedKeys(db, keys),
  ]);
  const plan = buildPreviewGarbageCollectionPlan(objects, registry, referencedKeys, input);

  if (plan.observations.length > 0) {
    await db.batch(
      plan.observations.map((observation) =>
        db
          .prepare(
            `
              INSERT INTO preview_object_registry (
                r2_key,
                creator_id,
                uploaded_at,
                first_seen_at,
                last_seen_at,
                last_reference_at,
                unreferenced_since,
                delete_after,
                deleted_at,
                last_error,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
              ON CONFLICT(r2_key) DO UPDATE SET
                creator_id = COALESCE(excluded.creator_id, preview_object_registry.creator_id),
                uploaded_at = excluded.uploaded_at,
                last_seen_at = excluded.last_seen_at,
                last_reference_at = CASE
                  WHEN excluded.last_reference_at IS NOT NULL THEN excluded.last_reference_at
                  ELSE preview_object_registry.last_reference_at
                END,
                unreferenced_since = excluded.unreferenced_since,
                delete_after = excluded.delete_after,
                deleted_at = NULL,
                last_error = NULL,
                updated_at = excluded.updated_at
            `,
          )
          .bind(
            observation.object.r2Key,
            observation.object.creatorId,
            observation.object.uploadedAt,
            input.now,
            input.now,
            observation.referenced ? input.now : null,
            observation.unreferencedSince,
            observation.deleteAfter,
            input.now,
          ),
      ),
    );
  }

  const finalReferencedKeys = input.deleteEnabled
    ? await loadReferencedKeys(db, plan.deletionCandidates)
    : new Set<string>();
  const deletionKeys = input.deleteEnabled
    ? plan.deletionCandidates.filter((key) => !finalReferencedKeys.has(key))
    : [];
  if (deletionKeys.length > 0) {
    try {
      await bucket.delete(deletionKeys);
      await db.batch(
        deletionKeys.map((key) =>
          db
            .prepare(
              `
                UPDATE preview_object_registry
                SET deleted_at = ?, last_error = NULL, updated_at = ?
                WHERE r2_key = ? AND deleted_at IS NULL
              `,
            )
            .bind(input.now, input.now, key),
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "unknown_error";
      await db.batch(
        deletionKeys.map((key) =>
          db
            .prepare(
              `
                UPDATE preview_object_registry
                SET last_error = ?, updated_at = ?
                WHERE r2_key = ?
              `,
            )
            .bind(message, input.now, key),
        ),
      );
      throw error;
    }
  }

  await db
    .prepare(
      `
        UPDATE preview_gc_state
        SET
          cursor = ?,
          last_run_at = ?,
          last_completed_at = CASE WHEN ? = 1 THEN ? ELSE last_completed_at END,
          last_scanned_count = ?,
          last_candidate_count = ?,
          last_deleted_count = ?
        WHERE id = 1
      `,
    )
    .bind(
      listed.truncated ? listed.cursor : null,
      input.now,
      listed.truncated ? 0 : 1,
      input.now,
      objects.length,
      plan.deletionCandidates.length,
      deletionKeys.length,
    )
    .run();

  return {
    scanned: objects.length,
    referenced: referencedKeys.size,
    candidates: plan.deletionCandidates.length,
    deleted: deletionKeys.length,
    deletionEnabled: input.deleteEnabled,
    scanCompleted: !listed.truncated,
  };
}

async function loadRegistrySnapshots(
  db: D1Database,
  keys: string[],
): Promise<Map<string, PreviewRegistrySnapshot>> {
  if (keys.length === 0) return new Map();
  const result = await db
    .prepare(
      `
        WITH requested_keys(r2_key) AS (
          SELECT CAST(value AS TEXT) FROM json_each(?)
        )
        SELECT registry.r2_key, registry.unreferenced_since, registry.deleted_at
        FROM preview_object_registry AS registry
        INNER JOIN requested_keys USING (r2_key)
      `,
    )
    .bind(JSON.stringify(keys))
    .all<PreviewRegistrySnapshot>();
  return new Map((result.results ?? []).map((row) => [row.r2_key, row]));
}

async function loadReferencedKeys(db: D1Database, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const result = await db
    .prepare(
      `
        WITH requested_keys(r2_key) AS (
          SELECT CAST(value AS TEXT) FROM json_each(?)
        )
        SELECT requested_keys.r2_key
        FROM requested_keys
        WHERE EXISTS (
          SELECT 1
          FROM assets
          WHERE preview_url IS NOT NULL
            AND instr(preview_url, '/api/' || requested_keys.r2_key) > 0
        ) OR EXISTS (
          SELECT 1
          FROM submissions
          WHERE preview_url IS NOT NULL
            AND instr(preview_url, '/api/' || requested_keys.r2_key) > 0
        )
      `,
    )
    .bind(JSON.stringify(keys))
    .all<{ r2_key: string }>();
  return new Set((result.results ?? []).map((row) => row.r2_key));
}

function boundedInteger(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!raw || !/^\d+$/u.test(raw)) return fallback;
  const parsed = Number(raw);
  return parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function parseTimestamp(value: string, label: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ${label} timestamp.`);
  return timestamp;
}
