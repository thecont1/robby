import { describe, expect, it } from "vitest";
import { normalizeLiveRenderableIr, renderFingerprint } from "./liveRenderer";

const liveIr = (paletteK: number, reverseMode: "palette-grid" | "provenance-map") => ({
  version: "robby-ir-v1", canvas: { base: "IMG_20210916_185510.jpg", width: 1440, height: 1080 }, cutouts: [], layers: [], palette: { k: paletteK }, reverse: [{ mode: reverseMode, ...(reverseMode === "palette-grid" ? { k: paletteK } : {}) }], output: { obverse: "ignored.png", reverse: "ignored.png", manifest: "ignored.json" },
});

describe("live image render configuration", () => {
  it("keeps a changed palette declaration in the normalized execution IR", () => {
    expect(normalizeLiveRenderableIr(liveIr(9, "palette-grid")).palette).toEqual({ k: 9 });
  });

  it("creates distinct render work for palette and reverse configuration changes", () => {
    const paletteEight = normalizeLiveRenderableIr(liveIr(8, "palette-grid"));
    const paletteNine = normalizeLiveRenderableIr(liveIr(9, "palette-grid"));
    const provenance = normalizeLiveRenderableIr(liveIr(8, "provenance-map"));
    expect(renderFingerprint(paletteEight)).not.toBe(renderFingerprint(paletteNine));
    expect(renderFingerprint(paletteEight)).not.toBe(renderFingerprint(provenance));
  });

  it("rejects programs that need unregistered live cutout assets", () => {
    expect(() => normalizeLiveRenderableIr({ ...liveIr(8, "palette-grid"), cutouts: [{ id: "subject", source: "unregistered.png", mask: "person" }] })).toThrow("base-only programs");
  });
});
