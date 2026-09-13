import { describe, expect, it } from "vitest";
import { buildDefaultGalleryScript, parseGalleryScriptSettings, readJpegDimensions } from "./galleryMetadata";

function jpegWithDimensions(width: number, height: number) {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

describe("constitutional gallery metadata", () => {
  it("reads JPEG dimensions from file bytes without an image-analysis runtime", () => {
    expect(readJpegDimensions(jpegWithDimensions(640, 480))).toEqual({ width: 640, height: 480 });
    expect(readJpegDimensions(Buffer.from("not-jpeg"))).toEqual({ width: 0, height: 0 });
  });

  it("generates only the canonical negative script with transient targets", () => {
    const script = buildDefaultGalleryScript("source.jpg");
    expect(script).toContain('base("source.jpg")');
    expect(script).toContain("palette(k: 8)");
    expect(script).toContain('reverse(mode: "negative")');
    expect(script).toContain('reverse: "transient"');
    expect(script).not.toMatch(/palette-grid|provenance-map|cutout|mask/i);
  });

  it("escapes quotes when generating a default script", () => {
    const script = buildDefaultGalleryScript('quote"name.jpg');
    expect(script).toContain('base("quote\\"name.jpg")');
    expect(script).not.toContain('base("quote"name.jpg")');
  });

  it("parses the bounded palette setting and canonical module", () => {
    expect(parseGalleryScriptSettings('base("x.jpg")\npalette(k: 16)\nreverse(mode: "negative")')).toEqual({ paletteK: 16, reverseMode: "negative" });
    expect(() => parseGalleryScriptSettings('base("x.jpg")\npalette(k: 17)\nreverse(mode: "negative")')).toThrow("between 3 and 16");
    expect(() => parseGalleryScriptSettings('base("x.jpg")\npalette(k: 8)\nreverse(mode: "retired")')).toThrow("registered reverse modules");
    expect(parseGalleryScriptSettings('base("x.jpg")\npalette(k: 8)\nreverse(mode: "observability_sheet")')).toEqual({
      paletteK: 8,
      reverseMode: "observability_sheet",
    });
  });

  it("keeps the legacy negative fallback for single-quoted palette_grid metadata", () => {
    // The metadata reader understands single-quoted spans so declaration-like
    // text inside them is ignored, but gallery metadata historically resolves
    // this single-quoted mode form to the negative fallback.
    expect(parseGalleryScriptSettings("base('x.jpg')\npalette(k: 8)\nreverse(mode: 'palette_grid')")).toEqual({
      paletteK: 8,
      reverseMode: "negative",
    });
  });

  it("ignores declarations embedded in either quote style", () => {
    const script = `base('reverse(mode: "palette_grid").jpg')
# "palette(k: 16)"
palette(k: 8)
reverse(mode: "negative")`;
    expect(parseGalleryScriptSettings(script)).toEqual({ paletteK: 8, reverseMode: "negative" });
  });

  it("does not read declaration arguments out of quoted values", () => {
    const palette = `base("x.jpg")
palette(note: "old, k: 16", k: 8)
reverse(mode: "negative")`;
    expect(parseGalleryScriptSettings(palette).paletteK).toBe(8);

    const reverse = `base("x.jpg")
palette(k: 8)
reverse(note: "old, mode: 'retired'")`;
    expect(parseGalleryScriptSettings(reverse).reverseMode).toBe("negative");
  });

  it("rejects duplicate real declarations instead of reading only the first", () => {
    expect(() => parseGalleryScriptSettings(`palette(k: 8)
palette(k: 12)
reverse(mode: "negative")`)).toThrow("duplicate palette");
    expect(() => parseGalleryScriptSettings(`palette(k: 8)
reverse(mode: "negative")
reverse(mode: "palette_grid")`)).toThrow("duplicate reverse");
  });

  // Bug reproduction: the lexer treats `#` as a comment, but the regex
  // scanner matches `palette(k: ...)` inside comments and poisons the item.
  it("ignores palette declarations inside # comments", () => {
    const script = `# retired setting: palette(k: 99)
base("x.jpg")
palette(k: 8)
reverse(mode: "negative")
output(obverse: "x.jpg", reverse: "transient", manifest: "transient")`;
    expect(parseGalleryScriptSettings(script)).toEqual({ paletteK: 8, reverseMode: "negative" });
  });

  // Bug reproduction: `palette( k: 12 )` is valid per the Rust lexer but the
  // regex requires `k:` immediately after `(` and silently reports k = 8.
  it("reads k with interior whitespace around the argument list", () => {
    const script = `base("x.jpg")
palette( k: 12 )
reverse(mode: "negative")
output(obverse: "x.jpg", reverse: "transient", manifest: "transient")`;
    expect(parseGalleryScriptSettings(script).paletteK).toBe(12);
  });
});
