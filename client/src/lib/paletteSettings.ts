const PALETTE_DECLARATION = /palette\s*\(([^)]*)\)/;
const PALETTE_K_ARGUMENT = /k\s*:\s*([^,\s)]+)/;
const BASE_DECLARATION = /base\s*\(/;

/** The part of a source line before a `#` comment, ignoring `#` inside strings. */
function codePortion(line: string): string {
  let quote: string | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === "#") return line.slice(0, index);
  }
  return line;
}

function paletteKFromDeclaration(inner: string): number {
  const trimmed = inner.trim();
  if (!trimmed) return 8; // `palette()` leaves the default in place
  const kArgument = trimmed.match(PALETTE_K_ARGUMENT)?.[1];
  const value = Number(kArgument);
  if (!kArgument || !Number.isInteger(value) || value < 3 || value > 16) {
    throw new Error("k must be an integer between 3 and 16.");
  }
  return value;
}

export function paletteKFromSource(source: string): number {
  const declaration = source
    .split("\n")
    .map(codePortion)
    .map(line => line.match(PALETTE_DECLARATION))
    .find(match => match !== null);
  if (!declaration) return 8; // `palette` is optional; omission means k = 8
  return paletteKFromDeclaration(declaration[1]);
}

export function replacePaletteK(source: string, value: number): string {
  if (!Number.isInteger(value) || value < 3 || value > 16) {
    throw new Error("k must be an integer between 3 and 16.");
  }
  const lines = source.split("\n");
  const declarationIndex = lines.findIndex(line => PALETTE_DECLARATION.test(codePortion(line)));
  if (declarationIndex >= 0) {
    lines[declarationIndex] = lines[declarationIndex].replace(PALETTE_DECLARATION, `palette(k: ${value})`);
    return lines.join("\n");
  }
  // `palette` is optional — inject the declaration between `base` and `reverse`.
  const baseIndex = lines.findIndex(line => BASE_DECLARATION.test(codePortion(line)));
  if (baseIndex < 0) throw new Error("Source must declare base(...) before palette k can be set.");
  lines.splice(baseIndex + 1, 0, `palette(k: ${value})`);
  return lines.join("\n");
}
