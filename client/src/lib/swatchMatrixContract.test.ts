import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const matrixSource = readFileSync(new URL("../components/SwatchMatrix.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");
const counterSource = readFileSync(new URL("../components/TeppanyakiCounter.tsx", import.meta.url), "utf8");

describe("swatch matrix reverse artwork contract", () => {
  it("uses p5 for a square palette matrix and GSAP for row/column choreography", () => {
    expect(matrixSource).toContain('import gsap from "gsap"');
    expect(matrixSource).toContain('import p5 from "p5"');
    expect(matrixSource).toContain("seededPermutation(k, (seed + row)");
    expect(matrixSource).toContain("swapRows");
    expect(matrixSource).toContain("swapColumns");
    expect(matrixSource).toContain('duration: 0.6');
  });

  it("pauses and resumes animation based on whether the inverse face is visible", () => {
    expect(matrixSource).toContain("animation?.pause()");
    expect(matrixSource).toContain("animation.resume()");
    expect(homeSource).toContain("<SwatchMatrix");
    expect(homeSource).toContain('active={face === "inverse"}');
  });

  it("exposes the binding seed and C2PA distinction in the counter", () => {
    expect(homeSource).toContain("swatchSeedToken");
    expect(counterSource).toContain("SWATCH SEED");
    expect(counterSource).toContain("swatchC2paPresent");
  });
});
