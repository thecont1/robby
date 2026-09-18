export type PaletteMatrix = number[][];
export type PaletteAxis = "row" | "column";

export type PaletteMove = {
  axis: PaletteAxis;
  index: number;
  amount: number;
};

/** Convert a hexadecimal compiler seed into a stable 32-bit PRNG seed. */
export function hashPaletteSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a balanced, seeded field so every declared swatch gets visual space. */
export function createPaletteMatrix(paletteSize: number, rows: number, columns: number, seed: string): PaletteMatrix {
  if (paletteSize < 1 || rows < 1 || columns < 1) return [];
  const values = Array.from({ length: rows }, () => Array<number>(columns));
  const cells = rows * columns;
  const indices = Array.from({ length: cells }, (_, index) => index % paletteSize);
  const random = mulberry32(hashPaletteSeed(seed));

  for (let index = indices.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [indices[index], indices[swap]] = [indices[swap], indices[index]];
  }

  for (let index = 0; index < cells; index += 1) {
    values[Math.floor(index / columns)][index % columns] = indices[index];
  }
  return values;
}

/** Shift one complete row or column, preserving the exact palette counts. */
export function shiftPaletteMatrix(matrix: PaletteMatrix, move: PaletteMove): PaletteMatrix {
  if (matrix.length === 0 || matrix[0]?.length === 0) return matrix;
  const rows = matrix.length;
  const columns = matrix[0].length;
  const next = matrix.map(row => row.slice());
  const amount = ((move.amount % (move.axis === "row" ? columns : rows)) + (move.axis === "row" ? columns : rows)) % (move.axis === "row" ? columns : rows);
  const index = ((move.index % (move.axis === "row" ? rows : columns)) + (move.axis === "row" ? rows : columns)) % (move.axis === "row" ? rows : columns);

  if (move.axis === "row") {
    const row = matrix[index];
    for (let column = 0; column < columns; column += 1) {
      next[index][(column + amount) % columns] = row[column];
    }
  } else {
    for (let row = 0; row < rows; row += 1) {
      next[(row + amount) % rows][index] = matrix[row][index];
    }
  }
  return next;
}

/** Generate a deterministic Rubik-like move sequence from the compiler seed. */
export function paletteMoveFor(seed: string, moveNumber: number, rows: number, columns: number): PaletteMove {
  const random = mulberry32(hashPaletteSeed(`${seed}:${moveNumber}`));
  const axis: PaletteAxis = random() < 0.5 ? "row" : "column";
  const length = axis === "row" ? rows : columns;
  const span = axis === "row" ? columns : rows;
  return {
    axis,
    index: Math.floor(random() * length),
    amount: Math.max(1, Math.floor(random() * Math.max(2, span))),
  };
}
