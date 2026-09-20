import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const matrixSource = readFileSync(new URL("../components/SwatchMatrix.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");
const counterSource = readFileSync(new URL("../components/TeppanyakiCounter.tsx", import.meta.url), "utf8");

describe("swatch matrix reverse artwork contract", () => {
  it("uses p5 for a square palette matrix and GSAP for square-pair burst choreography", () => {
    expect(matrixSource).toContain('import gsap from "gsap"');
    expect(matrixSource).toContain('import p5 from "p5"');
    expect(matrixSource).toContain("startBurst");
    expect(matrixSource).toContain("Math.floor(k / 2)");
    expect(matrixSource).toContain("k / 4");
    expect(matrixSource).toContain("BURST_PAUSE_SECONDS = 0.5");
    expect(matrixSource).not.toContain("swapRows");
    expect(matrixSource).not.toContain("swapColumns");
  });

  it("renders a square matrix surface with the GPS terrain in a separate right panel", () => {
    expect(matrixSource).toContain("Math.min(width, height)");
    expect(matrixSource).toContain("instance.createCanvas(side, side)");
    expect(matrixSource).toContain("sketch.resizeCanvas(side, side)");
    expect(matrixSource).toContain("--matrix-side");
    expect(matrixSource).toContain("<GeneralizedTerrain terrain={terrain} />");
    expect(matrixSource).toContain("swatch-matrix-terrain");
    expect(matrixSource).toContain("terrain?: Terrain | null");
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
