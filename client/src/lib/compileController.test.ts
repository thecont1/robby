import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompileController, type CompileDeps } from "./compileController";
import type { CompileEvent, CompileRequest } from "./compileEvents";
import type { RobbyIr } from "./robbyCompiler";

const ir: RobbyIr = {
  version: "robby-ir-v1",
  canvas: { base: "source.jpg", width: null, height: null },
  palette: { k: 8 },
  reverse: { mode: "negative" },
  output: { obverse: "front.jpg", reverse: "transient", manifest: "transient" },
  meta: { script_sha256: "recipehash".padEnd(64, "0") },
};

function request(overrides: Partial<CompileRequest> = {}): CompileRequest {
  return {
    galleryItemId: "item-a",
    sourceName: "source.jpg",
    sourceUrl: "/gallery/source.jpg",
    recipeSource: 'base("source.jpg")\npalette(k: 8)\nreverse(mode: "negative")\noutput(obverse: "front.jpg", reverse: "transient", manifest: "transient")',
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(next => {
    resolve = next;
  });
  return { promise, resolve };
}

function deps(overrides: Partial<CompileDeps> = {}): CompileDeps & { calls: string[] } {
  const calls: string[] = [];
  let clock = 0;
  let ids = 0;
  const base: CompileDeps & { calls: string[] } = {
    calls,
    fetchSourceBytes: async () => {
      calls.push("fetchSourceBytes");
      return new Uint8Array([1, 2, 3]);
    },
    sha256Hex: async value => {
      calls.push("sha256Hex");
      return typeof value === "string" ? `s:${value}`.padEnd(64, "0") : "sourcebytes".padEnd(64, "a");
    },
    compileRecipe: async () => {
      calls.push("compileRecipe");
      return ir;
    },
    inspectC2pa: async () => {
      calls.push("inspectC2pa");
      return {
        status: "absent",
        sourceSha256: "sourcebytes".padEnd(64, "a"),
        verificationMethod: "c2pa-node",
        note: "No credential",
      };
    },
    renderReverse: async () => {
      calls.push("renderReverse");
      return {
        blob: new Blob(["png"], { type: "image/png" }),
        manifest: {
          version: "robby-render-manifest-v1",
          source_obverse_sha256: "sourcebytes".padEnd(64, "a"),
          script_settings_sha256: "settings".padEnd(64, "b"),
          derived_seed: "seed".padEnd(64, "c"),
          output_sha256: "output".padEnd(64, "d"),
          render_module: "negative",
          colour_swatches: ["#112233"],
          cached_intermediate: null,
        },
      };
    },
    now: () => `2026-09-13T00:00:0${clock++}Z`,
    createId: () => `run-${++ids}`,
    createObjectUrl: blob => `blob:${blob.size}`,
    revokeObjectUrl: () => {
      calls.push("revokeObjectUrl");
    },
    compilerVersion: "robby-compiler-v0.1.0",
    rendererVersion: "robby-render-manifest-v1",
    ...overrides,
  };
  return base;
}

describe("CompileController", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does no compile work until an explicit compile request", () => {
    const environment = deps();
    createCompileController(environment);
    expect(environment.calls).toEqual([]);
  });

  it("notifies subscribers as stations complete, without waiting for the reverse", async () => {
    const gate = deferred<void>();
    const environment = deps({
      renderReverse: async () => {
        environment.calls.push("renderReverse");
        await gate.promise;
        return {
          blob: new Blob(["png"], { type: "image/png" }),
          manifest: {
            version: "robby-render-manifest-v1",
            source_obverse_sha256: "sourcebytes".padEnd(64, "a"),
            script_settings_sha256: "settings".padEnd(64, "b"),
            derived_seed: "seed".padEnd(64, "c"),
            output_sha256: "output".padEnd(64, "d"),
            render_module: "negative",
            colour_swatches: ["#112233"],
            cached_intermediate: null,
          },
        };
      },
    });
    const controller = createCompileController(environment);
    const seen: string[] = [];
    const unsubscribe = controller.subscribe(run => {
      seen.push(`${run.status}:${run.events.at(-1)?.stage ?? "none"}:${run.events.at(-1)?.status ?? "none"}`);
    });
    const pending = controller.compile(request());
    await waitFor(() => environment.calls.includes("renderReverse"));
    expect(seen.some(entry => entry.startsWith("running:intake:"))).toBe(true);
    expect(seen.some(entry => entry.includes("bind:completed"))).toBe(true);
    gate.resolve();
    await pending;
    unsubscribe();
  });

  it("creates a fresh compileRunId and monotonic events on Compile Orio", async () => {
    const controller = createCompileController(deps());
    const first = await controller.compile(request());
    const second = await controller.compile(request());
    expect(first.id).toMatch(/^run-/);
    expect(second.id).not.toBe(first.id);
    expect(first.events.map(event => event.compileRunId).every(id => id === first.id)).toBe(true);
    const sequences = first.events.map(event => event.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(new Set(sequences).size).toBe(sequences.length);
    expect(COMPILE_STAGES_PRESENT(first.events)).toEqual([
      "intake",
      "read",
      "measure",
      "split",
      "declare",
      "bind",
      "resolve",
      "marry",
    ]);
    expect(first.status).toBe("completed");
    expect(first.result?.reverseObjectUrl).toBe("blob:3");
    expect(first.result?.disclosure.safe).toBe(true);
    expect(first.result?.disclosure.omitted).toEqual(expect.arrayContaining(["source pixels", "raw GPS", "filename"]));
    expect(first.result?.identity.canonicalPixelSha256).toBeNull();
    expect(first.result?.identity.objectBinding).not.toBe(first.result?.identity.sourceByteSha256);
    expect(first.result?.identity.canonicalRecipeSha256).not.toBe(first.result?.identity.authoredRecipeSha256);
    expect(first.result?.identity.canonicalRecipeSha256).toBe(ir.meta.script_sha256);
    expect(first.events.find(event => event.stage === "measure" && event.status === "completed")?.payload).toMatchObject({ pixelSha256: undefined });
    expect(first.events.find(event => event.stage === "bind" && event.status === "completed")?.payload.objectBinding).toBe(first.result?.identity.objectBinding);
  });

  it("does not start a second run while one is already running for the same selection", async () => {
    const gate = deferred<void>();
    const environment = deps({
      renderReverse: async () => {
        environment.calls.push("renderReverse");
        await gate.promise;
        return {
          blob: new Blob(["png"], { type: "image/png" }),
          manifest: {
            version: "robby-render-manifest-v1",
            source_obverse_sha256: "sourcebytes".padEnd(64, "a"),
            script_settings_sha256: "settings".padEnd(64, "b"),
            derived_seed: "seed".padEnd(64, "c"),
            output_sha256: "output".padEnd(64, "d"),
            render_module: "negative",
            colour_swatches: ["#112233"],
            cached_intermediate: null,
          },
        };
      },
    });
    const controller = createCompileController(environment);
    const pending = controller.compile(request());
    await waitFor(() => environment.calls.includes("renderReverse"));
    const duplicate = await controller.compile(request());
    expect(duplicate.status).toBe("running");
    expect(environment.calls.filter(call => call === "renderReverse")).toHaveLength(1);
    gate.resolve();
    const finished = await pending;
    expect(finished.id).toBe(duplicate.id);
    expect(finished.status).toBe("completed");
  });

  it("cancels an in-flight run so its result cannot update a later selection", async () => {
    const gate = deferred<void>();
    const environment = deps({
      renderReverse: async (_ir, signal) => {
        environment.calls.push("renderReverse");
        await gate.promise;
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        return {
          blob: new Blob(["png"], { type: "image/png" }),
          manifest: {
            version: "robby-render-manifest-v1",
            source_obverse_sha256: "sourcebytes".padEnd(64, "a"),
            script_settings_sha256: "settings".padEnd(64, "b"),
            derived_seed: "seed".padEnd(64, "c"),
            output_sha256: "output".padEnd(64, "d"),
            render_module: "negative",
            colour_swatches: ["#112233"],
            cached_intermediate: null,
          },
        };
      },
    });
    const controller = createCompileController(environment);
    const first = controller.compile(request());
    controller.cancelActive();
    gate.resolve();
    const cancelled = await first;
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.result).toBeUndefined();
    const later = await controller.compile(request({ galleryItemId: "item-b", sourceName: "other.jpg" }));
    expect(later.galleryItemId).toBe("item-b");
    expect(later.status).toBe("completed");
    expect(later.events.every(event => event.compileRunId === later.id)).toBe(true);
  });

  it("reuses a session-valid orio instead of re-rendering, and recompile forces a new run", async () => {
    const environment = deps();
    const controller = createCompileController(environment);
    const first = await controller.compile(request());
    const reused = await controller.compile(request());
    expect(reused.id).not.toBe(first.id);
    expect(reused.status).toBe("completed");
    expect(reused.result?.reverseObjectUrl).toBe(first.result?.reverseObjectUrl);
    expect(environment.calls.filter(call => call === "renderReverse")).toHaveLength(1);
    const forced = await controller.compile(request(), { force: true });
    expect(forced.id).not.toBe(first.id);
    expect(environment.calls.filter(call => call === "renderReverse")).toHaveLength(2);
  });
});

function COMPILE_STAGES_PRESENT(events: CompileEvent[]) {
  return [...new Set(events.map(event => event.stage))];
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error("timed out waiting for compile work to start");
}
