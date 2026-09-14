import { replacePaletteK, scanDeclarations } from "./paletteSettings";

export type RecipeReverseMode = "negative" | "observability_sheet" | "quantised_obverse" | "palette_grid";

/** Resolve the reverse module from a real declaration, never quoted/comment text. */
export function reverseModeFromSource(source: string, fallback: RecipeReverseMode): RecipeReverseMode {
  const declarations = scanDeclarations(source).filter(span => span.name === "reverse");
  if (declarations.length !== 1) return fallback;
  const match = declarations[0].inner.match(/^\s*mode\s*:\s*(["'])([^"']+)\1\s*$/);
  const mode = match?.[2];
  return mode === "negative" || mode === "observability_sheet" || mode === "quantised_obverse" || mode === "palette_grid"
    ? mode
    : fallback;
}

/**
 * An asynchronous validation result may update the visible workbench only when
 * both authorities that produced it are still current. Specimen identity alone
 * misses edits made while persistence is pending; source equality alone misses
 * a switch to another specimen with identical text.
 */
export function isCompiledSourceCurrent(
  compiledSpecimenId: string,
  compiledSource: string,
  selectedSpecimenId: string,
  currentSource: string,
): boolean {
  return compiledSpecimenId === selectedSpecimenId && compiledSource === currentSource;
}

/** Structured controls edit the visible authored source; they never override it at execution time. */
export function editPaletteInRecipe(source: string, paletteK: number): string {
  return replacePaletteK(source, paletteK);
}

/** The compiler receives the exact source the user can inspect before execution. */
export function authoredRecipeForCompile(source: string): string {
  return source;
}
