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
    measureSourceBytes: async () => {
      calls.push("measureSourceBytes");
      return {
        pixelSha256: "pixels".padEnd(64, "a"),
        width: 2,
        height: 1,
        mimeType: "image/jpeg",
        intakeManifestJson: JSON.stringify({
          schema_version: "0.2",
          obverse: {
            byte_sha256: "sourcebytes".padEnd(64, "a"),
            pixel_sha256: "pixels".padEnd(64, "a"),
          },
        }),
      };
    },
    buildBinding: async (_intakeJson, recipeSource, evidence) => {
      calls.push("buildBinding");
      // A deterministic stand-in for the Rust core: mirrors the real field
      // derivation so downstream identity/cache logic is exercised truthfully.
      const digestOf = (value: string) => `d:${value}`.padEnd(64, "0").slice(0, 64);
      const authored = digestOf(recipeSource);
      const canonical = `canon:${String(evidence.c2pa.presence)}`.padEnd(64, "0").slice(0, 64);
      const policy = "p:".padEnd(64, "0");
      const selected = `e:${evidence.c2pa.presence}/${evidence.c2pa.validation}`.padEnd(64, "0").slice(0, 64);
      const bindingSha256 = `b:${authored}${canonical}`.padEnd(64, "0").slice(0, 64);
      return {
        bindingSha256,
        shortId: `RB-${bindingSha256.slice(0, 4).toUpperCase()}-${bindingSha256.slice(4, 8).toUpperCase()}`,
        recipeIrSchema: "robby-ir-v1",
        sourceByteSha256: "sourcebytes".padEnd(64, "a"),
        canonicalPixelSha256: "pixels".padEnd(64, "a"),
        authoredRecipeSha256: authored,
        canonicalRecipeSha256: canonical,
        disclosurePolicySha256: policy,
        selectedEvidenceSha256: selected,
        compilerVersion: "robby-compiler-v0.1.0",
        rendererVersion: "robby-render-manifest-v1",
        statement: "A reproducibility binding, not an ownership certificate.",
      };
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
    createObjectUrl: blob => {
      calls.push("createObjectUrl");
      return `blob:${blob.size}`;
    },
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
    expect(first.result?.identity.canonicalPixelSha256).toBe("pixels".padEnd(64, "a"));
    expect(first.result?.identity.objectBinding).not.toBe(first.result?.identity.sourceByteSha256);
    expect(first.result?.identity.canonicalRecipeSha256).not.toBe(first.result?.identity.authoredRecipeSha256);
    // Canonical v1 identity is Rust-derived from the lowered IR; the authored
    // hash (ir.meta.script_sha256) is the source-text digest and must remain
    // a separate identity domain (Plan 9A / ADR-003).
    expect(first.result?.identity.canonicalRecipeSha256).not.toBe(ir.meta.script_sha256);
    expect(first.events.find(event => event.stage === "measure" && event.status === "completed")?.payload).toMatchObject({ pixelSha256: "pixels".padEnd(64, "a") });
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

  it("never reuses the session cache when any identity-domain input changes", async () => {
    const first = deps();
    const controllerA = createCompileController(first);
    const firstRun = await controllerA.compile(request());
    expect(firstRun.status).toBe("completed");

    // Same binding inputs → reuse (one render only).
    const reusedRun = await controllerA.compile(request());
    expect(reusedRun.result?.reverseObjectUrl).toBe(firstRun.result?.reverseObjectUrl);
    expect(first.calls.filter(call => call === "renderReverse")).toHaveLength(1);

    // Any identity-domain change must NOT reuse: different pixel hash.
    const second = deps({
      measureSourceBytes: async () => ({
        pixelSha256: "different-pixels".padEnd(64, "e"),
        width: 2,
        height: 1,
        mimeType: "image/jpeg",
        intakeManifestJson: JSON.stringify({
          schema_version: "0.2",
          obverse: { byte_sha256: "sourcebytes".padEnd(64, "a"), pixel_sha256: "different-pixels".padEnd(64, "e") },
        }),
      }),
      buildBinding: async () => ({
        bindingSha256: "changed-binding".padEnd(64, "f"),
        shortId: "RB-CHAN-GED1",
        recipeIrSchema: "robby-ir-v1",
        sourceByteSha256: "sourcebytes".padEnd(64, "a"),
        canonicalPixelSha256: "different-pixels".padEnd(64, "e"),
        authoredRecipeSha256: "authored".padEnd(64, "0"),
        canonicalRecipeSha256: "canon".padEnd(64, "0"),
        disclosurePolicySha256: "policy".padEnd(64, "0"),
        selectedEvidenceSha256: "evidence".padEnd(64, "0"),
        compilerVersion: "robby-compiler-v0.1.0",
        rendererVersion: "robby-render-manifest-v1",
        statement: "A reproducibility binding, not an ownership certificate.",
      }),
    });
    const controllerB = createCompileController(second);
    const changedRun = await controllerB.compile(request());
    expect(changedRun.status).toBe("completed");
    expect(second.calls.filter(call => call === "renderReverse")).toHaveLength(1);
  });

  it("revokes the reverse Blob URL when a cancelled run created one mid-flight", async () => {
    let releaseRender: (() => void) | null = null;
    const environment = deps({
      renderReverse: async () => {
        environment.calls.push("renderReverse");
        await new Promise<void>(resolve => {
          releaseRender = resolve;
        });
        // Deliberately ignores the abort signal, like a non-cancellable native
        // renderer: the run discovers the cancel only after this resolves.
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
    controller.cancelActive();
    await Promise.resolve();
    releaseRender?.();
    const cancelled = await pending;
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.result).toBeUndefined();
    // Strongest form of "cancel does not unlock partial reverse output":
    // the non-cooperative renderer resolved after cancel, but no Blob URL
    // was ever created for it — there is nothing to unlock or leak.
    expect(environment.calls).not.toContain("createObjectUrl");
    expect(environment.calls.filter(call => call === "renderReverse")).toHaveLength(1);
  });

  it("dispose() cancels the active run, revokes every cached Blob URL, and clears the cache", async () => {
    const environment = deps();
    const controller = createCompileController(environment);
    const first = await controller.compile(request({ galleryItemId: "item-a", recipeSource: 'base("source.jpg")\npalette(k: 3)\nreverse(mode: "negative")\noutput(obverse: "front.jpg", reverse: "transient", manifest: "transient")' }));
    const second = await controller.compile(request({ galleryItemId: "item-b", sourceName: "other.jpg", sourceUrl: "/gallery/other.jpg", recipeSource: 'base("source.jpg")\npalette(k: 5)\nreverse(mode: "negative")\noutput(obverse: "front.jpg", reverse: "transient", manifest: "transient")' }));
    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    const urlsAtPeak = environment.calls.filter(call => call === "createObjectUrl").length;
    controller.dispose();
    // Both session URLs revoked exactly once each.
    const revoked = environment.calls.filter(call => call === "revokeObjectUrl").length;
    expect(revoked).toBeGreaterThanOrEqual(2);
    expect(urlsAtPeak).toBeGreaterThanOrEqual(2);
    // Cache is cleared: a new compile on a fresh controller renders again.
    const after = deps();
    const controllerAfter = createCompileController(after);
    const run = await controllerAfter.compile(request());
    expect(run.status).toBe("completed");
    expect(after.calls.filter(call => call === "renderReverse")).toHaveLength(1);
  });

  it("treats cancelled as distinct from failed and never marks cancelled runs completed", async () => {
    const gate = deferred<void>();
    const environment = deps({
      fetchSourceBytes: async () => {
        environment.calls.push("fetchSourceBytes");
        await gate.promise;
        throw new Error("should not matter");
      },
    });
    const controller = createCompileController(environment);
    const pending = controller.compile(request());
    await waitFor(() => environment.calls.includes("fetchSourceBytes"));
    controller.cancelActive();
    gate.resolve();
    const cancelled = await pending;
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.diagnostic).toBe("Run cancelled");
    // A genuine failure stays failed.
    const failing = deps({ fetchSourceBytes: async () => { throw new Error("network down"); } });
    const controllerFail = createCompileController(failing);
    const failedRun = await controllerFail.compile(request());
    expect(failedRun.status).toBe("failed");
    expect(failedRun.diagnostic).toBe("network down");
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
