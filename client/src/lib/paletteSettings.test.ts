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

  it("injects the optional palette declaration after base when absent", () => {
    expect(replacePaletteK('base("source.jpg")', 8)).toBe('base("source.jpg")\npalette(k: 8)');
    expect(() => replacePaletteK('reverse(mode: "negative")', 8)).toThrow("base(...)");
  });

  // Bug reproduction: `#` is a comment in the Robby lexer, but the regex
  // matches `palette(k: ...)` inside comments first.
  it("ignores palette declarations inside # comments", () => {
    const commented = `# retired: palette(k: 12)\n${source}`;
    expect(paletteKFromSource(commented)).toBe(8);
    const changed = replacePaletteK(commented, 5);
    expect(paletteKFromSource(changed)).toBe(5);
    expect(changed).toContain("# retired: palette(k: 12)");
  });

  // Bug reproduction: `palette( k: 12 )` is valid per the Rust lexer but the
  // pattern requires `k:` immediately after `(`.
  it("reads k with interior whitespace around the argument list", () => {
    expect(paletteKFromSource(source.replace("palette(k: 8)", "palette( k: 12 )"))).toBe(12);
  });

  // Bug reproduction: `palette` is optional per TECH-SPEC (omission means k=8),
  // but a script without it cannot be flipped — replacePaletteK throws.
  it("treats a missing palette declaration as the default k=8", () => {
    const noPalette = source.replace("palette(k: 8)\n", "");
    expect(paletteKFromSource(noPalette)).toBe(8);
    const changed = replacePaletteK(noPalette, 12);
    expect(changed.indexOf("palette(k: 12)")).toBeGreaterThan(changed.indexOf("base("));
    expect(changed.indexOf("palette(k: 12)")).toBeLessThan(changed.indexOf("reverse("));
  });
});
