import { describe, expect, it } from "vitest";

import {
  formatEurostatObservationValue,
  isReviewedEurostatSample,
  parseEurostatSample,
} from "../src/lib/ingest/eurostat-presentation";

const sampleJson = JSON.stringify({
  source: "eurostat",
  dataset_code: "tps00001",
  observation_count: 1,
  selector: { lang: "en", geo: "EU27_2020", sinceTimePeriod: "2020" },
  dimensions: [{ id: "time", label: "Time" }],
  observations: [
    {
      value: 451234,
      status: "e",
      coordinates: { time: "2020" },
      labels: { time: "2020" },
    },
  ],
});

describe("Eurostat marketplace presentation", () => {
  it("accepts the reviewed selector for any safe dataset code", () => {
    const sample = parseEurostatSample(sampleJson);
    expect(sample).not.toBeNull();
    expect(isReviewedEurostatSample(sample!)).toBe(true);
    expect(formatEurostatObservationValue(451234)).toBe("451,234");
    expect(
      isReviewedEurostatSample({ ...sample!, selector: { ...sample!.selector, geo: "DE" } }),
    ).toBe(false);
    expect(isReviewedEurostatSample({ ...sample!, datasetCode: "ei_bpm6ca_q" })).toBe(true);
    expect(isReviewedEurostatSample({ ...sample!, datasetCode: "ds-123" })).toBe(false);
  });

  it("fails closed for malformed or non-Eurostat metadata", () => {
    expect(parseEurostatSample(null)).toBeNull();
    expect(parseEurostatSample(JSON.stringify({ source: "owid" }))).toBeNull();
  });
});
