const JPEG_START_OF_FRAME = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

export function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return { width: 0, height: 0 };
  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if (JPEG_START_OF_FRAME.has(marker) && length >= 7) {
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += length;
  }
  return { width: 0, height: 0 };
}

export function buildDefaultGalleryScript(source: string): string {
  const quotedSource = JSON.stringify(source);
  return `# The JPEG is an opaque byte source plus RGB matrix. No content interpretation.
base(${quotedSource})
palette(k: 8)
reverse(mode: "negative")
output(obverse: ${quotedSource}, reverse: "transient", manifest: "transient")
`;
}

/** Drop `#` comments without touching `#` characters inside string literals. */
export function scriptCodeOnly(source: string): string {
  return source
    .split("\n")
    .map(line => {
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
    })
    .join("\n");
}

const GALLERY_REVERSE_MODES = ["negative", "observability_sheet", "quantised_obverse", "palette_grid"] as const;
export type GalleryReverseMode = (typeof GALLERY_REVERSE_MODES)[number];

/** The one palette algorithm the Rust renderer reports in its manifest. */
export const GALLERY_PALETTE_METHOD = "median_cut";

/** Human description of what each registered reverse module actually does. */
export function reverseModuleDescription(mode: GalleryReverseMode): string {
  switch (mode) {
    case "palette_grid":
      return "seed-shuffled palette grid module";
    case "quantised_obverse":
      return "palette-quantised obverse module";
    case "observability_sheet":
      return "observability sheet module";
    case "negative":
    default:
      return "seed-driven negative module";
  }
}

type ScriptDeclaration = { name: string; inner: string };

/**
 * Scan a `.robby` script for real `name(...)` declarations.
 *
 * A regex over raw source cannot tell a declaration from text inside a string
 * literal, so `base("reverse(mode: 'palette_grid').jpg")` would be misread as
 * a reverse declaration. This walks the source the way the compiler lexer
 * does: both quote styles delimit strings, backslash escapes are honoured,
 * `#` only opens a comment outside a string, and a declaration never spans a
 * newline. Only spans found outside strings and comments are returned.
 */
export function scanScriptDeclarations(source: string): ScriptDeclaration[] {
  const found: ScriptDeclaration[] = [];
  let index = 0;
  const skipString = (from: number) => {
    const quote = source[from];
    let cursor = from + 1;
    while (cursor < source.length) {
      const next = source[cursor];
      if (next === "\\") {
        cursor += 2;
        continue;
      }
      if (next === "\n") return cursor; // unterminated; the compiler reports it
      cursor += 1;
      if (next === quote) return cursor;
    }
    return cursor;
  };
  while (index < source.length) {
    const character = source[index];
    if (character === '"' || character === "'") {
      index = skipString(index);
      continue;
    }
    if (character === "#") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      const nameStart = index;
      while (index < source.length && /[A-Za-z0-9_-]/.test(source[index])) index += 1;
      let cursor = index;
      while (source[cursor] === " " || source[cursor] === "\t") cursor += 1;
      if (source[cursor] !== "(") continue;
      let depth = 0;
      let scan = cursor;
      let closed = -1;
      while (scan < source.length) {
        const next = source[scan];
        if (next === '"' || next === "'") {
          scan = skipString(scan);
          continue;
        }
        if (next === "\n") break;
        if (next === "(") depth += 1;
        else if (next === ")") {
          depth -= 1;
          if (depth === 0) {
            closed = scan;
            break;
          }
        }
        scan += 1;
      }
      if (closed < 0) continue;
      found.push({ name: source.slice(nameStart, index), inner: source.slice(cursor + 1, closed) });
      index = closed + 1;
      continue;
    }
    index += 1;
  }
  return found;
}

/** Read a `key: value` argument outside strings and nested calls. */
function declarationArgument(inner: string, key: string): { raw: string; quoted: boolean; quote: "\"" | "'" | null } | null {
  let segmentStart = 0;
  let index = 0;
  let depth = 0;
  const inspectSegment = (segmentEnd: number) => {
    let start = segmentStart;
    while (start < segmentEnd && /\s/.test(inner[start])) start += 1;
    let nameEnd = start;
    while (nameEnd < segmentEnd && /[A-Za-z0-9_-]/.test(inner[nameEnd])) nameEnd += 1;
    if (inner.slice(start, nameEnd) !== key) return null;
    let colon = nameEnd;
    while (colon < segmentEnd && /\s/.test(inner[colon])) colon += 1;
    if (inner[colon] !== ":") return null;
    let valueStart = colon + 1;
    while (valueStart < segmentEnd && /\s/.test(inner[valueStart])) valueStart += 1;
    let valueEnd = segmentEnd;
    while (valueEnd > valueStart && /\s/.test(inner[valueEnd - 1])) valueEnd -= 1;
    if (valueStart === valueEnd) return null;
    const encoded = inner.slice(valueStart, valueEnd);
    const first = encoded[0];
    const quote = (first === '"' || first === "'") && encoded.at(-1) === first
      ? first as '"' | "'"
      : null;
    return {
      raw: quote ? encoded.slice(1, -1).replace(/\\(.)/g, "$1") : encoded,
      quoted: quote !== null,
      quote,
    };
  };

  while (index <= inner.length) {
    const character = inner[index];
    if (character === '"' || character === "'") {
      const quote = character;
      index += 1;
      while (index < inner.length) {
        if (inner[index] === "\\") index += 2;
        else if (inner[index++] === quote) break;
      }
      continue;
    }
    if (character === "(") depth += 1;
    else if (character === ")" && depth > 0) depth -= 1;
    if ((character === "," && depth === 0) || index === inner.length) {
      const found = inspectSegment(index);
      if (found) return found;
      segmentStart = index + 1;
    }
    index += 1;
  }
  return null;
}

export function parseGalleryScriptSettings(script: string): { paletteK: number; reverseMode: GalleryReverseMode } {
  const declarations = scanScriptDeclarations(script);
  const paletteDeclarations = declarations.filter(entry => entry.name === "palette");
  if (paletteDeclarations.length > 1) throw new Error("duplicate palette declaration");
  const paletteDeclaration = paletteDeclarations[0];
  let paletteK = 8;
  if (paletteDeclaration && paletteDeclaration.inner.trim()) {
    const kArgument = declarationArgument(paletteDeclaration.inner, "k");
    paletteK = Number(kArgument?.raw);
    if (!kArgument || kArgument.quoted || kArgument.raw === "" || !Number.isInteger(paletteK) || paletteK < 3 || paletteK > 16) {
      throw new Error("palette k must be an integer between 3 and 16");
    }
  }
  const reverseDeclarations = declarations.filter(entry => entry.name === "reverse");
  if (reverseDeclarations.length > 1) throw new Error("duplicate reverse declaration");
  const reverseDeclaration = reverseDeclarations[0];
  // A mode must be an actual quoted string argument; `reverse()` or a bare
  // identifier falls back to the negative module, as it always has.
  const modeArgument = reverseDeclaration ? declarationArgument(reverseDeclaration.inner, "mode") : null;
  const reverseMode = modeArgument?.quoted ? modeArgument.raw : "negative";
  if (!GALLERY_REVERSE_MODES.includes(reverseMode as GalleryReverseMode)) {
    throw new Error("v1 supports only registered reverse modules");
  }
  return { paletteK, reverseMode: reverseMode as GalleryReverseMode };
}
