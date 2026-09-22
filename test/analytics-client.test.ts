import { describe, expect, it, vi } from "vitest";

import { getAnonymousSessionId } from "../src/components/analytics-client";

describe("anonymous browser analytics", () => {
  it("uses an ephemeral in-memory identifier without browser storage", () => {
    const getItem = vi.fn();
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem, setItem });

    const first = getAnonymousSessionId();
    const second = getAnonymousSessionId();

    expect(first).toMatch(/^[A-Za-z0-9_-]{8,128}$/u);
    expect(second).toBe(first);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
