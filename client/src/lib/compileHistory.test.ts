import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCompileHistory, persistCompileSnapshot, sortCompileHistory, type CompileSnapshot } from "./compileHistory";

const snapshot = (id: string, compiledAt: string) => ({ id, specimenId: "night-duality", source: "base(\"night.jpg\")", ir: { version: "robby-ir-v1" }, trace: [], compiledAt, irHash: id, origin: "editor" }) as unknown as CompileSnapshot;

describe("session-local compile history", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("orders stored records chronologically before diffing", () => {
    expect(sortCompileHistory([snapshot("later", "2026-08-18T11:00:00.000Z"), snapshot("earlier", "2026-08-18T10:00:00.000Z")]).map(item => item.id)).toEqual(["earlier", "later"]);
  });

  it("keeps snapshots in bounded process memory without touching IndexedDB", async () => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      get() {
        throw new Error("IndexedDB must not be used for Phase 10 session history");
      },
    });
    const specimenId = `session-${crypto.randomUUID()}`;
    for (let index = 0; index < 14; index += 1) {
      const record = snapshot(`record-${String(index).padStart(2, "0")}`, `2026-08-18T12:${String(index).padStart(2, "0")}:00.000Z`);
      record.specimenId = specimenId;
      await persistCompileSnapshot(record);
    }

    const history = await loadCompileHistory(specimenId);
    expect(history).toHaveLength(12);
    expect(history[0]?.id).toBe("record-02");
    expect(history.at(-1)?.id).toBe("record-13");
  });
});
