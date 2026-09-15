import type { AcceptedInput, NormalizeReport } from "./normalize-input";

export type CorpusBatchPlan = {
  total_accepted: number;
  selected_start: number;
  selected_count: number;
  batches: AcceptedInput[][];
};

export type CorpusBatchOptions = {
  start?: number;
  limit?: number;
  batch_size?: number;
};

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function planCorpusBatches(
  report: NormalizeReport,
  options: CorpusBatchOptions = {},
): CorpusBatchPlan {
  const start = nonNegativeInteger(options.start ?? 0, "start");
  const batchSize = positiveInteger(options.batch_size ?? 25, "batch_size");
  const available = Math.max(0, report.accepted.length - start);
  const limit = nonNegativeInteger(options.limit ?? available, "limit");
  const selected = report.accepted.slice(start, start + limit);
  const batches: AcceptedInput[][] = [];

  for (let index = 0; index < selected.length; index += batchSize) {
    batches.push(selected.slice(index, index + batchSize));
  }

  return {
    total_accepted: report.accepted.length,
    selected_start: start,
    selected_count: selected.length,
    batches,
  };
}
