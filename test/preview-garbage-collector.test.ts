import { describe, expect, it } from "vitest";

import {
  buildPreviewGarbageCollectionPlan,
  previewGarbageCollectionConfig,
  type PreviewObjectInventory,
  type PreviewRegistrySnapshot,
} from "../src/lib/storage/preview-garbage-collector";

const now = "2026-09-22T03:00:00.000Z";
const oldObject: PreviewObjectInventory = {
  r2Key: "submission-previews/11111111-1111-4111-8111-111111111111",
  creatorId: "creator-1",
  uploadedAt: "2026-05-01T00:00:00.000Z",
};

function registry(
  overrides: Partial<PreviewRegistrySnapshot> = {},
): Map<string, PreviewRegistrySnapshot> {
  return new Map([
    [
      oldObject.r2Key,
      {
        r2_key: oldObject.r2Key,
        unreferenced_since: "2026-09-01T03:00:00.000Z",
        deleted_at: null,
        ...overrides,
      },
    ],
  ]);
}

describe("preview garbage collection", () => {
  it("defaults to a non-destructive 90-day policy", () => {
    expect(previewGarbageCollectionConfig({})).toEqual({
      deleteEnabled: false,
      retentionDays: 90,
      confirmationDays: 7,
      maxObjects: 100,
    });
    expect(
      previewGarbageCollectionConfig({
        PREVIEW_GC_DELETE_ENABLED: "TRUE",
        PREVIEW_GC_RETENTION_DAYS: "2",
        PREVIEW_GC_CONFIRMATION_DAYS: "500",
      }),
    ).toEqual({
      deleteEnabled: false,
      retentionDays: 90,
      confirmationDays: 7,
      maxObjects: 100,
    });
  });

  it("never deletes a referenced object", () => {
    const plan = buildPreviewGarbageCollectionPlan(
      [oldObject],
      registry(),
      new Set([oldObject.r2Key]),
      { now, deleteEnabled: true, retentionDays: 90, confirmationDays: 7, maxObjects: 100 },
    );

    expect(plan.deletionCandidates).toEqual([]);
    expect(plan.observations[0]).toMatchObject({
      referenced: true,
      unreferencedSince: null,
      deleteAfter: null,
    });
  });

  it("requires a second observation even when an object is already old", () => {
    const plan = buildPreviewGarbageCollectionPlan([oldObject], new Map(), new Set(), {
      now,
      deleteEnabled: true,
      retentionDays: 90,
      confirmationDays: 7,
      maxObjects: 100,
    });

    expect(plan.deletionCandidates).toEqual([]);
    expect(plan.observations[0]?.unreferencedSince).toBe(now);
    expect(plan.observations[0]?.deleteAfter).toBe("2026-09-29T03:00:00.000Z");
  });

  it("reports confirmed candidates without deleting them during dry-run mode", () => {
    const plan = buildPreviewGarbageCollectionPlan([oldObject], registry(), new Set(), {
      now,
      deleteEnabled: false,
      retentionDays: 90,
      confirmationDays: 7,
      maxObjects: 100,
    });

    expect(plan.deletionCandidates).toEqual([oldObject.r2Key]);
    expect(plan.observations[0]?.deleteAfter).toBe("2026-09-08T03:00:00.000Z");
  });

  it("deletes only an old, confirmed, unreferenced object when explicitly enabled", () => {
    const plan = buildPreviewGarbageCollectionPlan([oldObject], registry(), new Set(), {
      now,
      deleteEnabled: true,
      retentionDays: 90,
      confirmationDays: 7,
      maxObjects: 100,
    });

    expect(plan.deletionCandidates).toEqual([oldObject.r2Key]);
  });

  it("keeps recently uploaded objects despite an old unreferenced marker", () => {
    const recentObject = { ...oldObject, uploadedAt: "2026-09-01T00:00:00.000Z" };
    const plan = buildPreviewGarbageCollectionPlan([recentObject], registry(), new Set(), {
      now,
      deleteEnabled: true,
      retentionDays: 90,
      confirmationDays: 7,
      maxObjects: 100,
    });

    expect(plan.deletionCandidates).toEqual([]);
    expect(plan.observations[0]?.deleteAfter).toBe("2026-11-30T00:00:00.000Z");
  });
});
