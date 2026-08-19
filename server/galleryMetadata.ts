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

export function parseGalleryScriptSettings(script: string): { paletteK: number; reverseMode: "negative" } {
  const paletteMatch = script.match(/palette\(k:\s*([^)\s]+)\s*\)/);
  const paletteK = Number(paletteMatch?.[1] ?? 8);
  if (!Number.isInteger(paletteK) || paletteK < 3 || paletteK > 16) {
    throw new Error("palette k must be an integer between 3 and 16");
  }
  const reverseMode = script.match(/reverse\(mode:\s*"([^"]+)"\s*\)/)?.[1] ?? "negative";
  if (reverseMode !== "negative") throw new Error("v1 supports only the negative render module");
  return { paletteK, reverseMode };
}
