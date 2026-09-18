import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");

describe("ephemeral inverse image rendering", () => {
  it("never renders a static gallery inverse source", () => {
    expect(homeSource).not.toContain("<img src={gallery[slideTransition.incomingIndex].reverse}");
    expect(homeSource).not.toContain("displayedInverse");
    expect(homeSource.match(/<ReverseArtwork result=\{displayedReverseResult\}/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
