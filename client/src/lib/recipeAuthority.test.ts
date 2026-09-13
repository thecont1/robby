import { describe, expect, it } from "vitest";
import { authoredRecipeForCompile, editPaletteInRecipe, isCompiledSourceCurrent, reverseModeFromSource } from "./recipeAuthority";

describe("recipe authority", () => {
  it("rewrites the authored recipe when the structured palette control changes", () => {
    const source = 'base("source.jpg")\npalette(k: 8)\nreverse(mode: "observability_sheet")';
    expect(editPaletteInRecipe(source, 3)).toContain("palette(k: 3)");
    expect(editPaletteInRecipe(source, 3)).not.toContain("palette(k: 8)");
  });

  it("submits the authored recipe without a hidden palette override", () => {
    const source = 'base("source.jpg")\npalette(k: 3)\nreverse(mode: "observability_sheet")';
    expect(authoredRecipeForCompile(source)).toBe(source);
  });

  it("resolves the active draft mode without reading strings or comments", () => {
    const source = `base("reverse(mode: 'palette_grid').jpg")
# reverse(mode: "negative")
reverse(mode: "quantised_obverse")`;
    expect(reverseModeFromSource(source, "negative")).toBe("quantised_obverse");
  });

  it("falls back for missing, duplicate, or invalid reverse declarations", () => {
    expect(reverseModeFromSource('base("source.jpg")', "palette_grid")).toBe("palette_grid");
    expect(reverseModeFromSource('reverse(mode: "retired")', "negative")).toBe("negative");
    expect(reverseModeFromSource('reverse(mode: "negative")\nreverse(mode: "palette_grid")', "observability_sheet")).toBe("observability_sheet");
  });

  it("rejects a stale validation completion after a specimen or source change", () => {
    const compiledSpecimenId = "render-source";
    const compiledSource = 'base("source.jpg")\npalette(k: 5)';

    expect(isCompiledSourceCurrent(compiledSpecimenId, compiledSource, "render-source", compiledSource)).toBe(true);
    expect(isCompiledSourceCurrent(compiledSpecimenId, compiledSource, "other", compiledSource)).toBe(false);
    expect(isCompiledSourceCurrent(compiledSpecimenId, compiledSource, "render-source", 'base("source.jpg")\npalette(k: 8)')).toBe(false);
  });
});
