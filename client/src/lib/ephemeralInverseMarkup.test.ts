import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");

describe("ephemeral inverse image rendering", () => {
  it("never renders an empty static inverse source", () => {
    expect(homeSource).not.toContain("<img src={gallery[slideTransition.incomingIndex].reverse}");
    expect(homeSource.match(/displayedInverse && <img src=\{displayedInverse\}/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
