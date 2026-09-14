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
  let urls = 0;
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
    buildBinding: async (intakeJson, recipeSource, evidence, compilerVersion, rendererVersion) => {
      calls.push("buildBinding");
      // A deterministic stand-in for the Rust core: mirrors the real field
      // derivation so downstream identity/cache logic is exercised truthfully.
      // Every buildBinding input feeds the binding digest, exactly as the Rust
      // core does — changing the intake manifest, the recipe, the evidence
      // selection, or either runtime version must produce a different binding.
      const digestOf = (value: string) => {
        let hash = 0x811c9dc5;
        for (let index = 0; index < value.length; index += 1) {
          hash ^= value.charCodeAt(index);
          hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        // Fold the length in too so distinct-but-colliding inputs stay apart.
        return `${hash.toString(16).padStart(8, "0")}${value.length.toString(16)}`.padEnd(64, "0").slice(0, 64);
      };
      const authored = digestOf(recipeSource);
      const canonical = digestOf(`canon:${recipeSource}`);
      const policy = digestOf("policy:robby-v1-default");
      const selected = digestOf(`e:${evidence.schema}/${evidence.c2pa.presence}/${evidence.c2pa.validation}/${evidence.c2pa.signerTrust}/${evidence.c2pa.availability}`);
      let intake: { obverse?: { byte_sha256?: string; pixel_sha256?: string } } = {};
      try {
        intake = JSON.parse(intakeJson);
      } catch {
        intake = {};
      }
      const sourceByteSha256 = intake.obverse?.byte_sha256 ?? "sourcebytes".padEnd(64, "a");
      const canonicalPixelSha256 = intake.obverse?.pixel_sha256 ?? "pixels".padEnd(64, "a");
      const bindingSha256 = digestOf([
        intakeJson,
        recipeSource,
        authored,
        canonical,
        policy,
        selected,
        compilerVersion,
        rendererVersion,
      ].join("\u0000"));
      return {
        bindingSha256,
        shortId: `RB-${bindingSha256.slice(0, 4).toUpperCase()}-${bindingSha256.slice(4, 8).toUpperCase()}`,
        recipeIrSchema: "robby-ir-v1",
        sourceByteSha256,
        canonicalPixelSha256,
        authoredRecipeSha256: authored,
        canonicalRecipeSha256: canonical,
        disclosurePolicySha256: policy,
        selectedEvidenceSha256: selected,
        compilerVersion,
        rendererVersion,
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
      // Unique per creation, like the real URL.createObjectURL: two renders
      // of identical bytes must still yield distinct handles.
      return `blob:${blob.size}:${++urls}`;
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
    expect(first.result?.reverseObjectUrl).toBe("blob:3:1");
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
    // An identical caller coalesces onto the same run: it receives the same
    // inflight promise rather than starting a second render.
    const duplicate = controller.compile(request());
    expect(environment.calls.filter(call => call === "renderReverse")).toHaveLength(1);
    gate.resolve();
    const finished = await pending;
    const coalesced = await duplicate;
    expect(finished.id).toBe(coalesced.id);
    expect(finished.status).toBe("completed");
    expect(coalesced.status).toBe("completed");
    expect(environment.calls.filter(call => call === "renderReverse")).toHaveLength(1);
  });

  it("does not coalesce a changed recipe onto an in-flight run for the same item", async () => {
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
    await waitFor(() => environment.calls.includes("renderReverse"));
    // Same gallery item, different recipe: this must start its own run
    // rather than silently receive the run compiled from the old source.
    const changedSource = 'base("source.jpg")\npalette(k: 5)\nreverse(mode: "negative")\noutput(obverse: "front.jpg", reverse: "transient", manifest: "transient")';
    const second = controller.compile(request({ recipeSource: changedSource }));
    gate.resolve();
    const cancelled = await first;
    const changed = await second;
    expect(cancelled.id).not.toBe(changed.id);
    expect(changed.recipeSource).toBe(changedSource);
    expect(changed.status).toBe("completed");
    expect(environment.calls.filter(call => call === "renderReverse")).toHaveLength(2);
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

  // Plan 10 WP-C required test 6: two rapid compile requests for the same
  // source. The latest run must win, and the superseded run must not be able
  // to overwrite it when its slower work finally lands.
  it("lets the latest run win when two compiles race for the same source", async () => {
    const firstGate = deferred<void>();
    let renders = 0;
    const environment = deps({
      renderReverse: async (_ir, signal) => {
        environment.calls.push("renderReverse");
        const mine = ++renders;
        // The first (superseded) render finishes LAST, so if the controller
        // were order-naive it would clobber the winner's result.
        if (mine === 1) await firstGate.promise;
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        return {
          blob: new Blob([`png${mine}`], { type: "image/png" }),
          manifest: {
            version: "robby-render-manifest-v1",
            source_obverse_sha256: "sourcebytes".padEnd(64, "a"),
            script_settings_sha256: "settings".padEnd(64, "b"),
            derived_seed: "seed".padEnd(64, "c"),
            output_sha256: `output${mine}`.padEnd(64, "d"),
            render_module: "negative",
            colour_swatches: ["#112233"],
            cached_intermediate: null,
          },
        };
      },
    });
    const controller = createCompileController(environment);
    const superseded = controller.compile(request());
    await waitFor(() => environment.calls.includes("renderReverse"));
    // force bypasses coalescing, producing a genuine second run for the same
    // request key. compile() cancels and awaits the in-flight run first, so
    // the gate must open for that cancellation to land — the abort signal is
    // what stops run 1, not the gate.
    const winnerPromise = controller.compile(request(), { force: true });
    firstGate.resolve();
    const winner = await winnerPromise;
    const loser = await superseded.catch(() => null);

    expect(winner.status).toBe("completed");
    expect(winner.result?.reverseOutputSha256).toBe(`output2`.padEnd(64, "d"));
    // The superseded run must never be reported as a completed current result.
    expect(loser?.status).not.toBe("completed");
    // And the controller's observable state still belongs to the winner: a
    // subsequent compile serves the winner's cached orio, not run 1's.
    const settled = await controller.compile(request());
    expect(settled.result?.reverseOutputSha256).toBe(`output2`.padEnd(64, "d"));
  });

  it("never reuses the session cache when any identity-domain input changes", async () => {
    // One controller and one session cache throughout: the point is that the
    // cache itself refuses to serve a stale orio, not that a fresh controller
    // starts empty.
    let pixelSha256 = "pixels".padEnd(64, "a");
    const environment = deps({
      measureSourceBytes: async () => {
        environment.calls.push("measureSourceBytes");
        return {
          pixelSha256,
          width: 2,
          height: 1,
          mimeType: "image/jpeg",
          intakeManifestJson: JSON.stringify({
            schema_version: "0.2",
            obverse: { byte_sha256: "sourcebytes".padEnd(64, "a"), pixel_sha256: pixelSha256 },
          }),
        };
      },
    });
    const controller = createCompileController(environment);
    const firstRun = await controller.compile(request());
    expect(firstRun.status).toBe("completed");

    // Same binding inputs → reuse (one render only).
    const reusedRun = await controller.compile(request());
    expect(reusedRun.result?.reverseObjectUrl).toBe(firstRun.result?.reverseObjectUrl);
    expect(environment.calls.filter(call => call === "renderReverse")).toHaveLength(1);

    // An identity-domain change (different canonical pixels) yields a
    // different binding, so the same controller must render again.
    pixelSha256 = "different-pixels".padEnd(64, "e");
    const changedRun = await controller.compile(request());
    expect(changedRun.status).toBe("completed");
    expect(changedRun.result?.identity.canonicalPixelSha256).toBe(pixelSha256);
    expect(changedRun.result?.reverseObjectUrl).not.toBe(firstRun.result?.reverseObjectUrl);
    expect(environment.calls.filter(call => call === "renderReverse")).toHaveLength(2);

    const afterPixel = await controller.compile(request());
    expect(afterPixel.result?.reverseObjectUrl).toBe(changedRun.result?.reverseObjectUrl);
    expect(environment.calls.filter(call => call === "renderReverse")).toHaveLength(2);

    const recipeRun = await controller.compile(request({
      recipeSource: 'base("source.jpg")\npalette(k: 5)\nreverse(mode: "negative")\noutput(obverse: "front.jpg", reverse: "transient", manifest: "transient")',
    }));
    expect(recipeRun.status).toBe("completed");
    expect(recipeRun.result?.reverseObjectUrl).not.toBe(changedRun.result?.reverseObjectUrl);
    expect(environment.calls.filter(call => call === "renderReverse")).toHaveLength(3);

    const presentThenAbsent = deps();
    let present = true;
    presentThenAbsent.inspectC2pa = async () => {
      presentThenAbsent.calls.push("inspectC2pa");
      return present
        ? { status: "present" as const, sourceSha256: "sourcebytes".padEnd(64, "a"), verificationMethod: "c2pa-node", note: "Signed" }
        : { status: "absent" as const, sourceSha256: "sourcebytes".padEnd(64, "a"), verificationMethod: "c2pa-node", note: "No credential" };
    };
    const evidenceController = createCompileController(presentThenAbsent);
    const signed = await evidenceController.compile(request());
    present = false;
    const unsigned = await evidenceController.compile(request());
    expect(unsigned.result?.reverseObjectUrl).not.toBe(signed.result?.reverseObjectUrl);
    expect(presentThenAbsent.calls.filter(call => call === "renderReverse")).toHaveLength(2);

    const versioned = deps();
    const versionController = createCompileController(versioned);
    const versionFirst = await versionController.compile(request());
    versioned.compilerVersion = "compiler-changed";
    const versionSecond = await versionController.compile(request());
    expect(versionSecond.result?.reverseObjectUrl).not.toBe(versionFirst.result?.reverseObjectUrl);
    expect(versioned.calls.filter(call => call === "renderReverse")).toHaveLength(2);
    versioned.rendererVersion = "renderer-changed";
    const versionThird = await versionController.compile(request());
    expect(versionThird.result?.reverseObjectUrl).not.toBe(versionSecond.result?.reverseObjectUrl);
    expect(versioned.calls.filter(call => call === "renderReverse")).toHaveLength(3);
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
    const first = await controller.compile(request({ recipeSource: 'base("source.jpg")\npalette(k: 3)\nreverse(mode: "negative")\noutput(obverse: "front.jpg", reverse: "transient", manifest: "transient")' }));
    const second = await controller.compile(request({ recipeSource: 'base("source.jpg")\npalette(k: 5)\nreverse(mode: "negative")\noutput(obverse: "front.jpg", reverse: "transient", manifest: "transient")' }));
    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    const urlsAtPeak = environment.calls.filter(call => call === "createObjectUrl").length;
    controller.dispose();
    // Both session URLs revoked exactly once each.
    const revoked = environment.calls.filter(call => call === "revokeObjectUrl").length;
    expect(revoked).toBeGreaterThanOrEqual(2);
    expect(urlsAtPeak).toBeGreaterThanOrEqual(2);
    // Cache is cleared: compiling again through the SAME controller renders
    // again, which is what proves dispose() emptied this controller's cache
    // rather than a new controller merely starting empty.
    const run = await controller.compile(request());
    expect(run.status).toBe("completed");
    const rendersAfterDispose = environment.calls.filter(call => call === "renderReverse").length;
    expect(rendersAfterDispose).toBeGreaterThan(2);
    expect(run.result?.reverseObjectUrl).toBeTruthy();
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

  it("passes public-safe sheet facts into renderReverse without mutating the IR", async () => {
    let captured: { ir: RobbyIr; sheet?: unknown } | undefined;
    const environment = deps({
      compileRecipe: async () => {
        environment.calls.push("compileRecipe");
        return { ...ir, reverse: { mode: "observability_sheet" } };
      },
      renderReverse: async (compiled, _signal, sheet) => {
        captured = { ir: compiled, sheet };
        return {
          blob: new Blob(["png"], { type: "image/png" }),
          manifest: {
            version: "robby-render-manifest-v1",
            source_obverse_sha256: "sourcebytes".padEnd(64, "a"),
            script_settings_sha256: "settings".padEnd(64, "b"),
            derived_seed: "seed".padEnd(64, "c"),
            output_sha256: "output".padEnd(64, "d"),
            render_module: "observability_sheet",
            colour_swatches: ["#112233"],
            cached_intermediate: null,
          },
        };
      },
    });
    const controller = createCompileController(environment);
    const run = await controller.compile(request({
      recipeSource: 'base("source.jpg")\npalette(k: 8)\nreverse(mode: "observability_sheet")\noutput(obverse: "front.jpg", reverse: "transient", manifest: "transient")',
    }));
    expect(run.status).toBe("completed");
    expect(captured?.ir.reverse.mode).toBe("observability_sheet");
    expect(captured?.ir).not.toHaveProperty("sheet");
    expect(captured?.sheet).toMatchObject({
      binding_short_id: expect.stringMatching(/^RB-/),
      reverse_mode: "observability_sheet",
      ir_schema: "robby-ir-v1",
      evidence: { gps: "UNAVAILABLE" },
      withheld: expect.arrayContaining(["source pixels", "filename"]),
    });
  });

  it("does not reuse a cached reverse when source bytes change", async () => {
    let generation = 0;
    const environment = deps({
      fetchSourceBytes: async () => {
        generation += 1;
        return new Uint8Array(generation === 1 ? [1, 2, 3] : [9, 9, 9]);
      },
      sha256Hex: async value => {
        if (typeof value === "string") return `s:${value}`.padEnd(64, "0").slice(0, 64);
        const tag = Array.from(value).join(",");
        return `src:${tag}`.padEnd(64, "a").slice(0, 64);
      },
      measureSourceBytes: async (_name, bytes) => {
        const tag = Array.from(bytes).join(",");
        const pixelSha256 = `pix:${tag}`.padEnd(64, "a").slice(0, 64);
        const sourceByteSha256 = `src:${tag}`.padEnd(64, "a").slice(0, 64);
        return {
          pixelSha256,
          width: 2,
          height: 1,
          mimeType: "image/jpeg",
          intakeManifestJson: JSON.stringify({
            schema_version: "0.2",
            obverse: { byte_sha256: sourceByteSha256, pixel_sha256: pixelSha256 },
          }),
        };
      },
      buildBinding: async (intakeJson) => {
        const intake = JSON.parse(String(intakeJson)) as { obverse: { byte_sha256: string; pixel_sha256: string } };
        const source = intake.obverse.byte_sha256;
        const pixels = intake.obverse.pixel_sha256;
        const bindingSha256 = `b:${source}${pixels}`.padEnd(64, "0").slice(0, 64);
        return {
          bindingSha256,
          shortId: `RB-${bindingSha256.slice(0, 4).toUpperCase()}-${bindingSha256.slice(4, 8).toUpperCase()}`,
          recipeIrSchema: "robby-ir-v1",
          sourceByteSha256: source,
          canonicalPixelSha256: pixels,
          authoredRecipeSha256: "authored".padEnd(64, "0"),
          canonicalRecipeSha256: "canonical".padEnd(64, "0"),
          disclosurePolicySha256: "p:".padEnd(64, "0"),
          selectedEvidenceSha256: "e:".padEnd(64, "0"),
          compilerVersion: "robby-compiler-v0.1.0",
          rendererVersion: "robby-render-manifest-v1",
          statement: "A reproducibility binding, not an ownership certificate.",
        };
      },
    });
    const controller = createCompileController(environment);
    const first = await controller.compile(request());
    expect(first.status, first.diagnostic).toBe("completed");
    const second = await controller.compile(request());
    expect(second.status, second.diagnostic).toBe("completed");
    expect(second.result?.identity.sourceByteSha256).not.toBe(first.result?.identity.sourceByteSha256);
    expect(second.result?.identity.objectBinding).not.toBe(first.result?.identity.objectBinding);
    expect(environment.calls.filter(call => call === "renderReverse")).toHaveLength(2);
  });

  it("continues compilation when optional C2PA inspection throws", async () => {
    const environment = deps({
      inspectC2pa: async () => {
        environment.calls.push("inspectC2pa");
        throw new Error("type is unsupported");
      },
    });
    const run = await createCompileController(environment).compile(request());
    expect(run.status, run.diagnostic).toBe("completed");
    expect(run.result?.c2paEvidence.availability).toBe("unavailable");
    expect(run.result?.c2paEvidence.note).toContain("type is unsupported");
    expect(environment.calls).toContain("measureSourceBytes");
    expect(environment.calls).toContain("renderReverse");
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
