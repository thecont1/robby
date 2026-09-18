/**
 * Extract the integer seed used by the reverse swatch choreography.
 *
 * A verified C2PA source uses the first 32 bits of the compiler binding seed.
 * Sources without a usable C2PA result intentionally share the neutral seed 42.
 */
export function swatchSeed(
  derivedSeed: string | undefined,
  c2paStatus: "absent" | "present" | "candidate" | "checking" | undefined,
): number {
  const candidate = derivedSeed?.trim() ?? "";
  if (c2paStatus === "present" && /^[0-9a-f]{8,}$/i.test(candidate)) {
    return Number.parseInt(candidate.slice(0, 8), 16) >>> 0;
  }
  return 42;
}

/** Return the visible seed token used in the counter’s provenance line. */
export function swatchSeedToken(
  derivedSeed: string | undefined,
  c2paStatus: "absent" | "present" | "candidate" | "checking" | undefined,
): string {
  if (c2paStatus === "present" && derivedSeed && /^[0-9a-f]{8,}$/i.test(derivedSeed.trim())) {
    return derivedSeed.trim().slice(0, 8).toUpperCase();
  }
  return "42";
}

/** Deterministic 32-bit generator corresponding to the Rust SplitMix family. */
export function splitMix32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
  };
}

/** Deterministic Fisher–Yates permutation of indices from 0 through n - 1. */
export function seededPermutation(n: number, seed: number): number[] {
  if (!Number.isInteger(n) || n < 1) return [];
  const random = splitMix32(seed);
  const values = Array.from({ length: n }, (_, index) => index);
  for (let index = n - 1; index > 0; index -= 1) {
    const swapIndex = random() % (index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}
