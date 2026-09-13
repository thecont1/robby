/**
 * A `name(...)` declaration found in real code, not inside a string or a
 * comment. Spans are half-open [start, end) offsets into the original source.
 */
export type DeclarationSpan = {
  name: string;
  /** Offset of the first character of the declaration name. */
  start: number;
  /** Offset just past the closing parenthesis. */
  end: number;
  /** The text between the parentheses, verbatim. */
  inner: string;
  /** Zero-based index of the line the declaration starts on. */
  line: number;
};

/**
 * Scan source for top-level `name(...)` declarations, skipping quoted strings
 * and `#` comments.
 *
 * This mirrors the compiler lexer's string rules: both quote styles are
 * recognised, backslash escapes are honoured, and a `#` only starts a comment
 * outside a string. Without this, `base("palette(k: 4).jpg")` would be read as
 * a palette declaration and could be rewritten, corrupting the source path.
 */
export function scanDeclarations(source: string): DeclarationSpan[] {
  const spans: DeclarationSpan[] = [];
  let index = 0;
  let line = 0;
  while (index < source.length) {
    const character = source[index];
    if (character === "\n") {
      line += 1;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      const quote = character;
      index += 1;
      while (index < source.length) {
        const next = source[index];
        if (next === "\\") {
          index += 2;
          continue;
        }
        if (next === "\n") break; // unterminated: let the compiler report it
        index += 1;
        if (next === quote) break;
      }
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
      while (cursor < source.length && (source[cursor] === " " || source[cursor] === "\t")) cursor += 1;
      if (source[cursor] !== "(") continue;
      // Walk to the matching `)`, skipping parentheses inside strings.
      let depth = 0;
      let scan = cursor;
      let closed = -1;
      while (scan < source.length) {
        const next = source[scan];
        if (next === '"' || next === "'") {
          const quote = next;
          scan += 1;
          while (scan < source.length) {
            const inner = source[scan];
            if (inner === "\\") {
              scan += 2;
              continue;
            }
            if (inner === "\n") break;
            scan += 1;
            if (inner === quote) break;
          }
          continue;
        }
        if (next === "\n") break; // a declaration does not span lines
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
      spans.push({
        name: source.slice(nameStart, index),
        start: nameStart,
        end: closed + 1,
        inner: source.slice(cursor + 1, closed),
        line,
      });
      // Continue scanning after the declaration; count any newlines skipped.
      for (let step = index; step <= closed; step += 1) {
        if (source[step] === "\n") line += 1;
      }
      index = closed + 1;
      continue;
    }
    index += 1;
  }
  return spans;
}
type ArgumentSpan = {
  valueStart: number;
  valueEnd: number;
  raw: string;
  quote: '"' | "'" | null;
};

/** Find one named argument outside quoted strings and nested calls. */
function namedArgument(inner: string, key: string): ArgumentSpan | null {
  let segmentStart = 0;
  let index = 0;
  let depth = 0;
  const inspectSegment = (segmentEnd: number): ArgumentSpan | null => {
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
    const first = inner[valueStart];
    const quote = (first === '"' || first === "'") && inner[valueEnd - 1] === first
      ? first as '"' | "'"
      : null;
    return { valueStart, valueEnd, raw: inner.slice(valueStart, valueEnd), quote };
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

function paletteKFromDeclaration(inner: string): number {
  const trimmed = inner.trim();
  if (!trimmed) return 8; // `palette()` leaves the default in place
  const argument = namedArgument(inner, "k");
  const value = Number(argument?.raw);
  if (!argument || argument.quote || !Number.isInteger(value) || value < 3 || value > 16) {
    throw new Error("k must be an integer between 3 and 16.");
  }
  return value;
}

export function paletteKFromSource(source: string): number {
  const declarations = scanDeclarations(source).filter(span => span.name === "palette");
  if (declarations.length > 1) throw new Error("Source contains duplicate palette declarations.");
  const declaration = declarations[0];
  if (!declaration) return 8; // `palette` is optional; omission means k = 8
  return paletteKFromDeclaration(declaration.inner);
}

export function replacePaletteK(source: string, value: number): string {
  if (!Number.isInteger(value) || value < 3 || value > 16) {
    throw new Error("k must be an integer between 3 and 16.");
  }
  const spans = scanDeclarations(source);
  const paletteDeclarations = spans.filter(span => span.name === "palette");
  if (paletteDeclarations.length > 1) throw new Error("Source contains duplicate palette declarations.");
  const palette = paletteDeclarations[0];
  if (palette) {
    const argument = namedArgument(palette.inner, "k");
    if (!argument) {
      // `palette()` is valid and means the default; adding k is the smallest
      // edit that preserves any existing whitespace and other arguments.
      const insertion = palette.end - 1;
      const separator = palette.inner.trim() ? ", " : "";
      return `${source.slice(0, insertion)}${separator}k: ${value}${source.slice(insertion)}`;
    }
    const valueStart = palette.start + palette.name.length
      + source.slice(palette.start + palette.name.length, palette.end).indexOf("(") + 1
      + argument.valueStart;
    const valueEnd = valueStart + (argument.valueEnd - argument.valueStart);
    return `${source.slice(0, valueStart)}${value}${source.slice(valueEnd)}`;
  }
  // `palette` is optional — inject the declaration between `base` and `reverse`.
  const base = spans.find(span => span.name === "base");
  if (!base) throw new Error("Source must declare base(...) before palette k can be set.");
  const lines = source.split("\n");
  lines.splice(base.line + 1, 0, `palette(k: ${value})`);
  return lines.join("\n");
}
