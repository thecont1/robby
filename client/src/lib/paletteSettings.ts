const PALETTE_PATTERN = /palette\(k:\s*([^)\s]+)\s*\)/;

export function paletteKFromSource(source: string): number {
  const match = source.match(PALETTE_PATTERN);
  if (!match) throw new Error("Source must declare palette(k: ...).");
  const value = Number(match[1]);
  if (!Number.isInteger(value) || value < 3 || value > 16) {
    throw new Error("k must be an integer between 3 and 16.");
  }
  return value;
}

export function replacePaletteK(source: string, value: number): string {
  if (!Number.isInteger(value) || value < 3 || value > 16) {
    throw new Error("k must be an integer between 3 and 16.");
  }
  if (!PALETTE_PATTERN.test(source)) throw new Error("Source must declare palette(k: ...).");
  return source.replace(PALETTE_PATTERN, `palette(k: ${value})`);
}
