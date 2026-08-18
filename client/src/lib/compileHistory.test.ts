import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadCompileHistory, persistCompileSnapshot, sortCompileHistory, type CompileSnapshot } from "./compileHistory";

const snapshot = (id: string, compiledAt: string) => ({ id, specimenId: "night-duality", source: "base(\"night.jpg\")", ir: { version: "robby-ir-v1" }, trace: [], compiledAt, irHash: id, origin: "editor" }) as unknown as CompileSnapshot;

describe("persistent compile history", () => {
  it("orders stored records chronologically before diffing", () => {
    expect(sortCompileHistory([snapshot("later", "2026-08-18T11:00:00.000Z"), snapshot("earlier", "2026-08-18T10:00:00.000Z")]).map(item => item.id)).toEqual(["earlier", "later"]);
  });

  it("round-trips a snapshot through IndexedDB for a later browser session", async () => {
    const record = snapshot("persisted", "2026-08-18T12:00:00.000Z");
    record.specimenId = "persistence-test";
    await persistCompileSnapshot(record);
    expect((await loadCompileHistory("persistence-test")).map(item => item.id)).toEqual(["persisted"]);
  });
});
