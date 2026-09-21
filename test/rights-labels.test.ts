import { describe, expect, it } from "vitest";

import { obligationLabel, permissionLabel } from "../src/lib/assets/rights-labels";

describe("asset rights labels", () => {
  it.each([
    [true, "Allowed"],
    [false, "Not allowed"],
    [null, "Unknown"],
  ] as const)("formats permission value %s", (value, expected) => {
    expect(permissionLabel(value)).toBe(expected);
  });

  it.each([
    [true, "Required"],
    [false, "Not required"],
    [null, "Unknown"],
  ] as const)("formats obligation value %s", (value, expected) => {
    expect(obligationLabel(value)).toBe(expected);
  });
});
