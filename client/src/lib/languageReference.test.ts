import { describe, expect, it } from "vitest";
import { languageReference } from "./languageReference";

describe("language reference", () => {
  it("documents every reverse mode accepted by the v1 validator", () => {
    const reverse = languageReference.find(command => command.name === "reverse");
    expect(reverse).toBeDefined();
    for (const mode of ["negative", "observability_sheet", "quantised_obverse", "palette_grid"]) {
      expect(reverse?.syntax).toContain(mode);
      expect(reverse?.parameters[0]?.type).toContain(mode);
      expect(`${reverse?.description} ${reverse?.parameters[0]?.detail}`).toContain(mode);
    }
  });
});
