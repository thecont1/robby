import { describe, expect, it } from "vitest";
import { normalizeLiveRenderableIr, renderFingerprint } from "./liveRenderer";

const liveIr = (k = 8) => ({
  version: "robby-ir-v1",
  canvas: { base: "MS202401-Ayodhya0041.jpg", width: null, height: null },
  palette: { k },
  reverse: { mode: "negative" },
  output: { obverse: "front.jpg", reverse: "transient", manifest: "transient" },
  meta: { script_sha256: "a".repeat(64) },
});

describe("live image render configuration", () => {
  it("normalizes the canonical Rust IR without inventing image semantics", () => {
    expect(normalizeLiveRenderableIr(liveIr(9))).toEqual(liveIr(9));
  });

  it("creates distinct deterministic work for changed palette settings", () => {
    expect(renderFingerprint(normalizeLiveRenderableIr(liveIr(8))))
      .not.toBe(renderFingerprint(normalizeLiveRenderableIr(liveIr(9))));
    expect(renderFingerprint(normalizeLiveRenderableIr(liveIr(8))))
      .toBe(renderFingerprint(normalizeLiveRenderableIr(liveIr(8))));
  });

  it.each([
    ["legacy cutout", { cutouts: [] }],
    ["legacy layers", { layers: [] }],
    ["legacy reverse array", { reverse: [{ mode: "negative" }] }],
    ["retired mode", { reverse: { mode: "palette-grid" } }],
  ])("rejects %s rather than silently translating it", (_label, legacy) => {
    expect(() => normalizeLiveRenderableIr({ ...liveIr(), ...legacy })).toThrow();
  });

  it.each([2, 2.5, 17])("rejects invalid palette k=%s", (k) => {
    expect(() => normalizeLiveRenderableIr(liveIr(k))).toThrow("between 3 and 16");
  });

  it("rejects extra undeclared fields", () => {
    expect(() => normalizeLiveRenderableIr({ ...liveIr(), semanticHint: "person" })).toThrow("Unknown IR field");
  });
});
