import { describe, expect, it } from "vitest";
import { pedagogicDetail, traceDiff } from "@/components/Build06Panels";

describe("Build 06 trace derivations", () => {
  it("rewrites palette trace steps in accessible teaching language", () => {
    expect(pedagogicDetail({ stage: "02", label: "Calculate palette", code: "palette(k: 8)", detail: "" })).toContain("groups");
  });

  it("reports an unavailable diff without manufacturing prior history", () => {
    expect(traceDiff(undefined, [{ stage: "01", label: "Base canvas", code: 'base("image.jpg")', detail: "" }]).kind).toBe("none");
  });
});
