import { describe, expect, it } from "vitest";
import { paletteKFromSource, replacePaletteK } from "./paletteSettings";

const source = `base("source.jpg")
palette(k: 8)
reverse(mode: "negative")
output(obverse: "source.jpg", reverse: "transient", manifest: "transient")
`;

describe("editable palette k", () => {
  it("reads and rewrites exactly the palette declaration", () => {
    expect(paletteKFromSource(source)).toBe(8);
    const changed = replacePaletteK(source, 12);
    expect(paletteKFromSource(changed)).toBe(12);
    expect(changed).toContain('reverse(mode: "negative")');
    expect(changed).toContain('reverse: "transient"');
  });

  it.each([2, 17, 7.5])("rejects an invalid k value: %s", value => {
    expect(() => replacePaletteK(source, value)).toThrow("integer between 3 and 16");
  });

  it("rejects source with no palette declaration", () => {
    expect(() => replacePaletteK('base("source.jpg")', 8)).toThrow("palette(k: ...)");
  });
});
