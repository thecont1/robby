import { describe, expect, it } from "vitest";
import type { CompileRun } from "./compileEvents";
import { compileActions, isPaletteReprocessCurrent, shouldAcceptPaletteEdit, shouldStartCompileRequest } from "./compileActions";

function run(status: CompileRun["status"], withResult = status === "completed"): CompileRun {
  return {
    id: "run-1",
    galleryItemId: "ayodhya",
    sourceName: "MS202401-Ayodhya0041.jpg",
    recipeSource: "object \"orio\" {}",
    requestedAt: "2026-09-13T15:30:00.000Z",
    status,
    events: [],
    result: withResult
      ? {
          objectId: "orio-run-1",
          compileRunId: "run-1",
          galleryItemId: "ayodhya",
          sourceByteSha256: "abc",
          recipeSource: "object \"orio\" {}",
          canonicalRecipeHash: "def",
          reverseObjectUrl: "blob:orio",
          reverseOutputSha256: "ghi",
          renderModule: "observability_sheet",
          derivedSeed: "1",
          colourSwatches: ["#112233"],
          compilerVersion: "0.1.0",
          rendererVersion: "0.1.0",
          events: [],
          createdAt: "2026-09-13T15:30:00.000Z",
          disclosure: { safe: true, warnings: [], omitted: ["source pixels", "raw GPS"] },
        }
      : undefined,
  };
}

describe("compileActions", () => {
  it("keeps Turn to Inverse from starting a reverse when no orio exists", () => {
    const actions = compileActions({
      run: null,
      recipeChanged: false,
      face: "obverse",
      isRendering: false,
    });
    expect(actions.compileLabel).toBe("Compile Orio");
    expect(actions.compileEnabled).toBe(true);
    expect(actions.turnEnabled).toBe(false);
    expect(actions.showCancel).toBe(false);
  });

  it("uses Turn to Inverse only after a resolved orio, with Recompile as the compile action", () => {
    const actions = compileActions({
      run: run("completed"),
      recipeChanged: false,
      face: "obverse",
      isRendering: false,
    });
    expect(actions.compileLabel).toBe("Recompile Orio");
    expect(actions.compileForce).toBe(true);
    expect(actions.turnLabel).toBe("Turn to inverse");
    expect(actions.turnEnabled).toBe(true);
  });

  it("marks a recipe change as Compile Revised Orio and still allows viewing the previous reverse", () => {
    const actions = compileActions({
      run: run("completed"),
      recipeChanged: true,
      face: "obverse",
      isRendering: false,
    });
    expect(actions.compileLabel).toBe("Compile Revised Orio");
    expect(actions.turnLabel).toBe("View previous result");
    expect(actions.turnEnabled).toBe(true);
  });

  it("disables turning while compiling and offers cancel", () => {
    const actions = compileActions({
      run: run("running", false),
      recipeChanged: false,
      face: "obverse",
      isRendering: true,
    });
    expect(actions.compileLabel).toBe("Compiling Orio…");
    expect(actions.compileEnabled).toBe(false);
    expect(actions.turnEnabled).toBe(false);
    expect(actions.showCancel).toBe(true);
  });

  it("lets a newer compile supersede an inflight reverse instead of dropping it", () => {
    expect(shouldStartCompileRequest({ isFlipping: false, isRendering: true, supersedeInflight: true })).toBe(true);
    expect(shouldStartCompileRequest({ isFlipping: false, isRendering: true, supersedeInflight: false })).toBe(false);
    expect(shouldStartCompileRequest({ isFlipping: true, isRendering: false, supersedeInflight: true })).toBe(false);
  });

  it("keeps a delayed palette recompile only while specimen and source still match", () => {
    const scheduled = { specimenId: "render-source", source: 'palette(k: 12)' };
    expect(isPaletteReprocessCurrent(scheduled, scheduled)).toBe(true);
    expect(isPaletteReprocessCurrent(scheduled, { ...scheduled, source: 'palette(k: 17)' })).toBe(false);
    expect(isPaletteReprocessCurrent(scheduled, { ...scheduled, specimenId: "other" })).toBe(false);
  });

  it("accepts a palette edit even while a reverse is still rendering", () => {
    // Regression: the slider is controlled, so refusing the edit mid-compile
    // snapped the thumb back and left the authored recipe on the old k.
    for (const value of [3, 8, 12, 63, 64]) {
      expect(shouldAcceptPaletteEdit(value)).toBe(true);
    }
  });

  it("rejects palette values outside the 3..64 contract", () => {
    for (const value of [2, 0, -3, 65, 100]) {
      expect(shouldAcceptPaletteEdit(value)).toBe(false);
    }
  });

  it("rejects non-integer and non-finite palette values", () => {
    for (const value of [7.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(shouldAcceptPaletteEdit(value)).toBe(false);
    }
  });
});
