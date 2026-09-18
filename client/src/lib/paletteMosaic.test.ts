import { describe, expect, it } from "vitest";
import { createPaletteMatrix, hashPaletteSeed, paletteMoveFor, shiftPaletteMatrix } from "./paletteMosaic";

describe("palette mosaic", () => {
  it("creates the same balanced matrix for the same compiler seed", () => {
    const first = createPaletteMatrix(8, 5, 7, "seed-a");
    const second = createPaletteMatrix(8, 5, 7, "seed-a");
    expect(first).toEqual(second);
    expect(first.flat()).toHaveLength(35);
    expect(new Set(first.flat())).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
  });

  it("changes the seeded arrangement when the seed changes", () => {
    expect(hashPaletteSeed("seed-a")).not.toBe(hashPaletteSeed("seed-b"));
    expect(createPaletteMatrix(8, 5, 7, "seed-a")).not.toEqual(createPaletteMatrix(8, 5, 7, "seed-b"));
  });

  it("shifts rows and columns without changing palette counts", () => {
    const matrix = createPaletteMatrix(6, 4, 9, "seed-c");
    const movedRow = shiftPaletteMatrix(matrix, { axis: "row", index: 2, amount: 3 });
    const movedColumn = shiftPaletteMatrix(matrix, { axis: "column", index: 4, amount: 2 });
    expect(movedRow.flat().sort()).toEqual(matrix.flat().sort());
    expect(movedColumn.flat().sort()).toEqual(matrix.flat().sort());
    expect(movedRow).not.toEqual(matrix);
    expect(movedColumn).not.toEqual(matrix);
  });

  it("derives valid Rubik-like moves from the compiler seed", () => {
    const move = paletteMoveFor("seed-d", 9, 8, 12);
    expect(["row", "column"]).toContain(move.axis);
    expect(move.index).toBeGreaterThanOrEqual(0);
    expect(move.amount).toBeGreaterThan(0);
  });
});
