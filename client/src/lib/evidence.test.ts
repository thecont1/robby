import { describe, expect, it } from "vitest";
import { displayEpistemicClass, isEpistemicClass } from "./evidence";

describe("evidence taxonomy", () => {
  it("accepts only the documented epistemic classes", () => {
    expect(isEpistemicClass("observed")).toBe(true);
    expect(isEpistemicClass("verified")).toBe(true);
    expect(isEpistemicClass("proven")).toBe(false);
    expect(isEpistemicClass(null)).toBe(false);
    expect(isEpistemicClass(42)).toBe(false);
  });

  it("formats a class without changing its wire value", () => {
    expect(displayEpistemicClass("unavailable")).toBe("Unavailable");
  });
});
