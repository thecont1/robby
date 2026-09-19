import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");
const counter = readFileSync(new URL("../components/TeppanyakiCounter.tsx", import.meta.url), "utf8");
const evidence = readFileSync(new URL("../components/EmbeddedEvidencePanel.tsx", import.meta.url), "utf8");
const terrain = readFileSync(new URL("../components/GeneralizedTerrain.tsx", import.meta.url), "utf8");
const analysis = readFileSync(new URL("../components/IngredientAnalysisPanel.tsx", import.meta.url), "utf8");

 describe("ingredient analysis observation contract", () => {
  it("runs analysis from the counter tabs, not a separate inspect button", () => {
    expect(home).toContain("analyzeIngredientsWithRust");
    expect(analysis).not.toContain("Analyze ingredients");
    expect(evidence).not.toContain("Inspect evidence");
    expect(analysis).toContain("onAnalyze");
    expect(home).toContain("onAnalyzeIngredients={() => void analyzeIngredients()}");
    expect(home).toContain("selectCounterView");
    expect(home).toContain("ingredientRequestGeneration");
    expect(home).toContain("isCurrentRequest");
  });

  it("offers ingredients, stuffing, and baking views", () => {
    expect(counter).toContain(">Ingredients</button>");
    expect(counter).toContain(">Stuffing</button>");
    expect(counter).toContain(">Baking</button>");
    expect(counter).toContain("EmbeddedEvidencePanel");
  });

  it("does not expose raw GPS or metadata values in the evidence panel", () => {
    expect(evidence).toContain("Coordinates detected but withheld");
    expect(evidence).toContain("values remain private by default");
    expect(evidence).toContain("Show generalized terrain");
    expect(evidence).toContain("consentedSourceDigest");
    expect(evidence).toContain("analysis.source.byte_sha256");
    expect(evidence).toContain("no coordinates displayed");
    expect(evidence).toContain("<GeneralizedTerrain terrain={analysis.terrain}");
    expect(terrain).toContain("three");
    expect(terrain).toContain("Generalized coarse terrain representation");
    expect(terrain).toContain("prefers-reduced-motion");
    expect(evidence).not.toContain("analysis.evidence.gpsValue");
  });

  it("does not create a second reverse artwork from ingredient analysis", () => {
    expect(analysis).not.toContain("reverseObjectUrl");
    expect(analysis).not.toContain("<img");
    expect(home).toContain("<ReverseArtwork");
  });
});
