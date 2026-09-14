/**
 * Regression: "Palette change leaves recipe text stale".
 *
 * QA reported the palette control showing 5 and compiling k=5 while the
 * visible authored recipe still read `palette(k: 8)`. The workbench keeps the
 * authored source in a per-item draft store and feeds the SAME value to the
 * editor and to Compile Orio, so the invariant under test is: after any
 * structured edit, the stored draft, the value handed to the editor, and the
 * value handed to the compiler are one string.
 *
 * These tests exercise that store/authority contract directly rather than
 * mounting React: the repo's vitest environment is `node` with no DOM library.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRecipeDraftStore } from "./recipeDrafts";
import { authoredRecipeForCompile, editPaletteInRecipe } from "./recipeAuthority";
import { paletteKFromSource } from "./paletteSettings";

const SPECIMEN = "render-source";
const SCRIPT = 'base("render-source.jpg")\npalette(k: 8)\nreverse(mode: "negative")';
const HOME_SOURCE = readFileSync(
  fileURLToPath(new URL("../pages/Home.tsx", import.meta.url)),
  "utf8",
);

const SOURCE_EDITOR_SOURCE = readFileSync(
  fileURLToPath(new URL("../components/SourceEditor.tsx", import.meta.url)),
  "utf8",
);

/** What the palette control does on change, mirroring Home.tsx. */
function changePalette(store: ReturnType<typeof createRecipeDraftStore>, id: string, script: string, value: number) {
  const active = store.get(id, script);
  store.set(id, editPaletteInRecipe(active, value));
}

/** What the editor renders and what Compile Orio submits, mirroring Home.tsx. */
function visibleSource(store: ReturnType<typeof createRecipeDraftStore>, id: string, script: string) {
  return store.get(id, script);
}

describe("palette control and authored recipe stay synchronised", () => {
  it("wires the selected draft to both the editor and Compile Orio", () => {
    expect(HOME_SOURCE).toContain("const activeRecipe = selectedDraft;");
    expect(HOME_SOURCE).toContain("source={activeRecipe}");
    expect(HOME_SOURCE).toContain("paletteK={paletteK}");
    const freshnessGuards = HOME_SOURCE.match(/if \(!isCompiledSourceCurrent\(compiledSpecimenId, source, currentAuthority\.specimenId, currentAuthority\.source\)\) return;/g) ?? [];
    expect(freshnessGuards).toHaveLength(2); // Compile Orio + Validate recipe persistence
    expect(HOME_SOURCE).not.toContain("source={selected.script}");
  });

  it("re-seeds outside source changes before the browser paints", () => {
    expect(SOURCE_EDITOR_SOURCE).toContain("useLayoutEffect(() => {");
    expect(SOURCE_EDITOR_SOURCE).toContain("setDraft(source);");
  });

  it("returns to idle when an edit invalidates an in-flight validation", () => {
    const updateDraftBody = SOURCE_EDITOR_SOURCE.match(/const updateDraft = \(nextDraft: string\) => \{([\s\S]*?)\n  \};/)?.[1] ?? "";
    expect(updateDraftBody).toContain("compileGeneration.current += 1;");
    expect(updateDraftBody).toContain('setState({ kind: "idle" });');
  });

  it("invalidates outgoing compile notifications before committing a specimen switch", () => {
    const selectionBody = HOME_SOURCE.match(/const commitSelection = \(nextIndex: number\) => \{([\s\S]*?)\n  \};/)?.[1] ?? "";
    expect(selectionBody.indexOf('selectedIdRef.current = "";')).toBeGreaterThanOrEqual(0);
    expect(selectionBody.indexOf('selectedIdRef.current = "";')).toBeLessThan(selectionBody.indexOf("setSelectedIndex(nextIndex);"));
    expect(selectionBody).not.toContain("gallery[nextIndex]");
  });

  it("commits every draft-store mutation to a React render", () => {
    const storeWrites = HOME_SOURCE.match(/draftStore\.current\.(?:set|clear)\(/g) ?? [];
    const renderCommits = HOME_SOURCE.match(/bumpDraftRevision\(\);/g) ?? [];
    expect(storeWrites).toHaveLength(3);
    expect(renderCommits).toHaveLength(storeWrites.length + 1); // + selection re-seed
  });

  it("updates the visible recipe text when the palette control changes 8 -> 5", () => {
    const store = createRecipeDraftStore();
    changePalette(store, SPECIMEN, SCRIPT, 5);

    const visible = visibleSource(store, SPECIMEN, SCRIPT);
    expect(visible).toContain("palette(k: 5)");
    expect(visible).not.toContain("palette(k: 8)");
  });

  it("hands the compiler exactly the text the editor shows", () => {
    const store = createRecipeDraftStore();
    changePalette(store, SPECIMEN, SCRIPT, 5);

    const visible = visibleSource(store, SPECIMEN, SCRIPT);
    expect(authoredRecipeForCompile(visible)).toBe(visible);
    expect(paletteKFromSource(visible)).toBe(5);
  });

  it("keeps the structured control and the authored text agreeing across repeated edits", () => {
    const store = createRecipeDraftStore();
    for (const value of [5, 16, 3, 11]) {
      changePalette(store, SPECIMEN, SCRIPT, value);
      expect(paletteKFromSource(visibleSource(store, SPECIMEN, SCRIPT))).toBe(value);
    }
  });

  it("preserves a typed edit when the palette control is used afterwards", () => {
    const store = createRecipeDraftStore();
    // The user retitles the output by hand, then nudges the palette control.
    store.set(SPECIMEN, SCRIPT.replace("render-source.jpg", "typed.jpg"));
    changePalette(store, SPECIMEN, SCRIPT, 5);

    const visible = visibleSource(store, SPECIMEN, SCRIPT);
    expect(visible).toContain("typed.jpg");
    expect(paletteKFromSource(visible)).toBe(5);
  });

  it("keeps each specimen's palette edit separate", () => {
    const store = createRecipeDraftStore();
    const otherScript = 'base("night.jpg")\npalette(k: 8)';
    changePalette(store, SPECIMEN, SCRIPT, 5);
    changePalette(store, "night", otherScript, 12);

    expect(paletteKFromSource(visibleSource(store, SPECIMEN, SCRIPT))).toBe(5);
    expect(paletteKFromSource(visibleSource(store, "night", otherScript))).toBe(12);
  });

  it("returns to the specimen script after a reset, dropping the palette edit", () => {
    const store = createRecipeDraftStore();
    changePalette(store, SPECIMEN, SCRIPT, 5);
    store.clear(SPECIMEN);

    expect(visibleSource(store, SPECIMEN, SCRIPT)).toBe(SCRIPT);
    expect(paletteKFromSource(visibleSource(store, SPECIMEN, SCRIPT))).toBe(8);
  });

  it("adds a palette declaration when the recipe omits one", () => {
    const store = createRecipeDraftStore();
    const noPalette = 'base("render-source.jpg")\nreverse(mode: "negative")';
    changePalette(store, SPECIMEN, noPalette, 5);

    const visible = visibleSource(store, SPECIMEN, noPalette);
    expect(paletteKFromSource(visible)).toBe(5);
    expect(visible).toContain('reverse(mode: "negative")');
  });

  it("never rewrites palette-looking text inside a quoted filename", () => {
    const store = createRecipeDraftStore();
    const tricky = 'base("palette(k: 4).jpg")\npalette(k: 8)';
    changePalette(store, SPECIMEN, tricky, 5);

    const visible = visibleSource(store, SPECIMEN, tricky);
    expect(visible).toContain('base("palette(k: 4).jpg")');
    expect(paletteKFromSource(visible)).toBe(5);
  });

  it("rejects an out-of-range palette value without corrupting the stored draft", () => {
    const store = createRecipeDraftStore();
    changePalette(store, SPECIMEN, SCRIPT, 5);
    const before = visibleSource(store, SPECIMEN, SCRIPT);

    expect(() => changePalette(store, SPECIMEN, SCRIPT, 99)).toThrow();
    expect(visibleSource(store, SPECIMEN, SCRIPT)).toBe(before);
  });
});
