import { describe, expect, it } from "vitest";

import {
  isAnonymousSessionId,
  isPublicAssetEventType,
  publicAssetEventTypes,
} from "../src/lib/analytics/events";

describe("analytics event contract", () => {
  it("accepts only bounded anonymous session identifiers", () => {
    expect(isAnonymousSessionId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isAnonymousSessionId("email@example.com")).toBe(false);
    expect(isAnonymousSessionId("short")).toBe(false);
  });

  it("limits public asset events to detail and source interactions", () => {
    expect(publicAssetEventTypes).toEqual(["detail_view", "source_click"]);
    expect(isPublicAssetEventType("detail_view")).toBe(true);
    expect(isPublicAssetEventType("embed_copy")).toBe(false);
  });
});
