import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedProfile: vi.fn(),
}));

vi.mock("@/lib/auth/github", () => ({
  getAuthenticatedProfile: mocks.getAuthenticatedProfile,
}));

vi.mock("@/lib/db/client", () => ({
  getDatabase: () => ({ binding: "test-db" }),
}));

import { GET } from "../src/app/%5Feditorial/preview/[briefId]/route";

const request = new Request(
  "https://citesupply.com/_editorial/preview/cb-002-eu-renewable-share-patterns",
);

describe("private editorial preview route", () => {
  beforeEach(() => {
    mocks.getAuthenticatedProfile.mockReset();
  });

  it("serves the reviewed HTML only to an authenticated admin", async () => {
    mocks.getAuthenticatedProfile.mockResolvedValue({
      id: "admin:1",
      role: "admin",
      display_name: "Reviewer",
      website_url: null,
    });
    const response = await GET(request, {
      params: Promise.resolve({ briefId: "cb-002-eu-renewable-share-patterns" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(await response.text()).toContain(
      "What four EU renewable-energy shares actually measure",
    );
  });

  it("returns the same non-indexable 404 to a creator or an unknown brief", async () => {
    mocks.getAuthenticatedProfile.mockResolvedValue({
      id: "creator:1",
      role: "creator",
      display_name: "Creator",
      website_url: null,
    });
    const creatorResponse = await GET(request, {
      params: Promise.resolve({ briefId: "cb-002-eu-renewable-share-patterns" }),
    });
    const unknownResponse = await GET(request, {
      params: Promise.resolve({ briefId: "cb-999-unknown" }),
    });
    expect(creatorResponse.status).toBe(404);
    expect(unknownResponse.status).toBe(404);
    expect(creatorResponse.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(await creatorResponse.text()).toBe("Not found.");
    expect(await unknownResponse.text()).toBe("Not found.");
  });

  it("fails closed when session lookup throws", async () => {
    mocks.getAuthenticatedProfile.mockRejectedValue(new Error("D1 unavailable"));
    const response = await GET(request, {
      params: Promise.resolve({ briefId: "cb-003-hicp-inflation-explainer" }),
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
