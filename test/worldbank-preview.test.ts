import { describe, expect, it, vi } from "vitest";

import {
  fetchWorldBankPreview,
  normalizeWorldBankIndicator,
  WorldBankPreviewError,
} from "../src/lib/assets/worldbank-preview";

describe("World Bank preview fetch", () => {
  it("validates indicators before making a request", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    expect(normalizeWorldBankIndicator(" fb.bnk.capa.zs ")).toBe("FB.BNK.CAPA.ZS");
    expect(normalizeWorldBankIndicator("../secret")).toBeNull();
    await expect(fetchWorldBankPreview("../secret", fetchImplementation)).rejects.toMatchObject({
      status: 400,
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("returns selected real observations with a bounded cached upstream request", async () => {
    const body = [
      { page: 1 },
      [
        {
          country: { value: "United States" },
          countryiso3code: "USA",
          date: "2025",
          value: 12.5,
        },
        {
          country: { value: "Germany" },
          countryiso3code: "DEU",
          date: "2025",
          value: 9.25,
        },
      ],
    ];
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(fetchWorldBankPreview("fb.bnk.capa.zs", fetchImplementation)).resolves.toEqual([
      { country: "United States", iso3: "USA", date: "2025", value: 12.5 },
      { country: "Germany", iso3: "DEU", date: "2025", value: 9.25 },
    ]);
    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [url, init] = fetchImplementation.mock.calls[0]!;
    expect(String(url)).toContain("/indicator/FB.BNK.CAPA.ZS");
    expect(init?.cf).toMatchObject({ cacheEverything: true, cacheTtl: 86_400 });
  });

  it("fails closed when the upstream response is too large or empty", async () => {
    const oversized = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("[]", { headers: { "content-length": "512001" } }));
    await expect(fetchWorldBankPreview("SP.POP.TOTL", oversized)).rejects.toBeInstanceOf(
      WorldBankPreviewError,
    );

    const empty = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([{}, []])));
    await expect(fetchWorldBankPreview("SP.POP.TOTL", empty)).rejects.toMatchObject({
      status: 404,
    });
  });
});
