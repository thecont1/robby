import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");
const counterSource = readFileSync(new URL("../components/TeppanyakiCounter.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("observation deck interaction contract", () => {
  it("keeps the complete keyboard legend inside the Teppanyaki counter", () => {
    expect(counterSource).toContain("← → TO CYCLE · F TO FLIP · C TO COMPILE");
    expect(homeSource).not.toContain("← → TO CYCLE · F TO FLIP");
    expect(homeSource).toContain('event.key.toLowerCase() === "c"');
    expect(homeSource).toContain("compileOrio(actions.compileForce)");
  });

  it("gives obverse and inverse the same stage geometry", () => {
    expect(cssSource).toMatch(/\.two-sided-object,\s*\.two-sided-object\.four-three,\s*\.two-sided-object\.three-two \{ aspect-ratio:auto; height:min\(82cqi, 690px\); \}/);
    expect(cssSource).toMatch(/\.object-face \{[^}]*backface-visibility:\s*hidden/);
    expect(cssSource).toContain("height:100%;");
    expect(cssSource).toMatch(/\.object-face-inverse \{[^}]*transform:\s*rotateY\(180deg\)/);
  });

  it("renders an incoming remembered reverse instead of forcing obverse during slides", () => {
    expect(homeSource).toContain("const incomingRun = runBySpecimen.current[incoming.id];");
    expect(homeSource).toContain("const incomingFace = incomingRun?.result");
    expect(homeSource).toContain("<ReverseArtwork result={incomingRun?.result}");
  });
});
