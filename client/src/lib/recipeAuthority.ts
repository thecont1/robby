import { replacePaletteK } from "./paletteSettings";

/** Structured controls edit the visible authored source; they never override it at execution time. */
export function editPaletteInRecipe(source: string, paletteK: number): string {
  return replacePaletteK(source, paletteK);
}

/** The compiler receives the exact source the user can inspect before execution. */
export function authoredRecipeForCompile(source: string): string {
  return source;
}
