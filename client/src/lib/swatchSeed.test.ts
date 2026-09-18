import { describe, expect, it } from "vitest";
import { seededPermutation, splitMix32, swatchSeed, swatchSeedToken } from "./swatchSeed";

describe("swatchSeed", () => {
  it("uses the first eight binding-seed hex characters for present C2PA", () => {
    expect(swatchSeed("deadbeef1234567890", "present")).toBe(0xdeadbeef);
    expect(swatchSeedToken("deadbeef1234567890", "present")).toBe("DEADBEEF");
  });

  it("uses neutral seed 42 when C2PA is absent, candidate, or incomplete", () => {
    for (const status of ["absent", "candidate", "checking", undefined] as const) {
      expect(swatchSeed("deadbeef1234567890", status)).toBe(42);
      expect(swatchSeedToken("deadbeef1234567890", status)).toBe("42");
    }
    expect(swatchSeed("not-a-seed", "present")).toBe(42);
  });

  it("produces deterministic unsigned 32-bit values", () => {
    const first = splitMix32(42);
    const second = splitMix32(42);
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it("produces a complete permutation without duplicates", () => {
    const permutation = seededPermutation(8, 0xdeadbeef);
    expect(permutation).toHaveLength(8);
    expect([...permutation].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(seededPermutation(8, 0xdeadbeef)).toEqual(permutation);
    expect(seededPermutation(8, 0xdeadbeee)).not.toEqual(permutation);
  });
});
