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

  it("parses the bounded palette setting and canonical module", () => {
    expect(parseGalleryScriptSettings('base("x.jpg")\npalette(k: 16)\nreverse(mode: "negative")')).toEqual({ paletteK: 16, reverseMode: "negative" });
    expect(() => parseGalleryScriptSettings('base("x.jpg")\npalette(k: 17)\nreverse(mode: "negative")')).toThrow("between 3 and 16");
    expect(() => parseGalleryScriptSettings('base("x.jpg")\npalette(k: 8)\nreverse(mode: "retired")')).toThrow("negative");
  });
});
