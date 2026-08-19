import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const brief = readFileSync(new URL("../pages/ProjectBrief.tsx", import.meta.url), "utf8");

describe("constitutional project brief", () => {
  it("describes the current opaque-input Rust renderer instead of the retired semantic pipeline", () => {
    expect(brief).toContain('reverse(mode: "negative")');
    expect(brief).toContain("Rust");
    expect(brief).not.toMatch(/cutout\(|place\(|provenance-map|Python executes image operations|content images, masks/i);
  });

  it("does not present content understanding as a current Robby capability", () => {
    expect(brief).not.toMatch(/picture is segmented|choices involved in masking|analyzed for significant objects/i);
  });
});
