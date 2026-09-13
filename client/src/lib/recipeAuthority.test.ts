import { describe, expect, it } from "vitest";
import { authoredRecipeForCompile, editPaletteInRecipe } from "./recipeAuthority";

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
});
