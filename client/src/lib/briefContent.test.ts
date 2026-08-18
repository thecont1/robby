import { describe, expect, it } from "vitest";
import { briefSummaries } from "./briefContent";

describe("project brief navigation", () => {
  it("keeps both user-supplied source documents routable from the app", () => {
    expect(briefSummaries.hackathon.route).toBe("/brief/hackathon");
    expect(briefSummaries["image-object"].route).toBe("/brief/image-object");
    expect(briefSummaries["image-object"].title).toBe("Even Better Than the Real Thing?");
  });
});
