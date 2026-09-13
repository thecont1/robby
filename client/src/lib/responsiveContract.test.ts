import { describe, expect, it } from "vitest";
import { narrowScreenContract } from "./responsiveContract";

describe("narrow-screen contract", () => {
  it("keeps touch targets at least 44 CSS pixels", () => {
    expect(narrowScreenContract.minTouchTarget).toBe(44);
  });

  it("uses a single-column stage below 560px", () => {
    expect(narrowScreenContract.mobileBreakpoint).toBe(560);
    expect(narrowScreenContract.columns).toBe(1);
  });

  it("forbids viewport zoom lock", () => {
    expect(narrowScreenContract.viewport).not.toContain("maximum-scale=1");
  });
});
