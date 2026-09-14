import { describe, expect, it } from "vitest";
import type { CompileEvent, CompileRun } from "./compileEvents";
import { counterCopy, deriveCounterState, stationSummary, stationViews } from "./teppanyakiCounter";

const event = (stage: CompileEvent["stage"], sequence: number, status: CompileEvent["status"] = "completed"): CompileEvent => ({
  compileRunId: "run-1",
  sequence,
  stage,
  status,
  timestamp: "2026-09-13T00:00:00Z",
  label: stage,
  payload: {},
});

describe("Teppanyaki Counter derivation", () => {
  it("stays dormant with no run", () => {
    expect(deriveCounterState(null, false)).toBe("dormant");
    expect(counterCopy("dormant").kicker.toLowerCase()).toContain("resting");
  });

  it("marks a completed run stale after the recipe changes", () => {
    const run: CompileRun = {
      id: "run-1",
      galleryItemId: "item-a",
      sourceName: "source.jpg",
      recipeSource: "base(\"source.jpg\")",
      requestedAt: "2026-09-13T00:00:00Z",
      status: "completed",
      events: [event("intake", 1)],
    };
    expect(deriveCounterState(run, true)).toBe("stale");
  });

  it("renders fixed stations 00-07 from real events only", () => {
    const views = stationViews([event("intake", 1), event("read", 2, "started")]);
    expect(views.map(view => view.index)).toEqual(["00", "01", "02", "03", "04", "05", "06", "07"]);
    expect(views[0]?.status).toBe("completed");
    expect(views[1]?.status).toBe("started");
    expect(views[2]?.status).toBe("idle");
  });

  it("shows truncated hashes and bounded evidence, never full dumps", () => {
    expect(stationSummary("intake", {
      sourceByteSha256: "7f3a91c2aabbccddeeff00112233445566778899aabbccddeeff001122334455",
      byteSize: 482911,
    })).toBe("SOURCE 7F3A…4455 · 482911 B");
    expect(stationSummary("measure", { sourceByteSha256: "7f3a91c2aabbccddeeff00112233445566778899aabbccddeeff001122334455" })).toBe("PIXELS UNAVAILABLE");
    expect(stationSummary("measure", { pixelSha256: "a1b2c3d4e5f600112233445566778899aabbccddeeff00112233445566778899" })).toBe("PIXELS A1B2…8899");
    expect(stationSummary("read", {
      c2paStatus: "absent",
      gps: "private",
      note: "No Content Credentials on these bytes.",
    })).toBe("C2PA UNAVAILABLE · GPS PRIVATE");
    expect(stationSummary("read", { c2paStatus: "present", gps: "private" })).toBe("C2PA VERIFIED · GPS PRIVATE");
    expect(stationSummary("bind", {
      objectBinding: "7f3a91c200112233445566778899aabbccddeeff00112233445566778899aabb",
      statement: "A reproducibility record, not an ownership certificate.",
    })).toBe("7F3A…AABB · reproducibility record, not ownership");
    expect(stationSummary("resolve", {
      outputSha256: "e1d2a73b00112233445566778899aabbccddeeff00112233445566778899aabb",
      renderModule: "negative",
    })).toBe("REVERSE E1D2…AABB · negative");
    expect(stationSummary("split", {
      method: "median_cut",
      colourSwatches: ["#112233", "#445566", "#778899"],
    })).toBe("PALETTE median_cut · 3");
  });
});
