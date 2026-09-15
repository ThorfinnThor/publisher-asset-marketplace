import { describe, expect, it } from "vitest";

import { planCorpusBatches } from "../src/lib/ingest/corpus-plan";
import { normalizeOwidInput } from "../src/lib/ingest/normalize-input";

describe("planCorpusBatches", () => {
  const report = normalizeOwidInput(["one", "two", "three", "four", "five"].join("\n"), "txt");

  it("selects a restartable range and divides it into bounded batches", () => {
    const plan = planCorpusBatches(report, { start: 1, limit: 3, batch_size: 2 });

    expect(plan).toMatchObject({
      total_accepted: 5,
      selected_start: 1,
      selected_count: 3,
    });
    expect(plan.batches.map((batch) => batch.map((asset) => asset.slug))).toEqual([
      ["two", "three"],
      ["four"],
    ]);
  });

  it("rejects invalid batch controls", () => {
    expect(() => planCorpusBatches(report, { start: -1 })).toThrow(
      "start must be a non-negative integer",
    );
    expect(() => planCorpusBatches(report, { batch_size: 0 })).toThrow(
      "batch_size must be a positive integer",
    );
  });
});
