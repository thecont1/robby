import type { CredentialSignature } from "@/lib/demoData";
import type { RobbyIr } from "@/lib/robbyCompiler";
import type { EphemeralReverseResult } from "@/lib/liveRender";
import {
  COMPILE_STAGES,
  STATION_LABELS,
  sessionCacheKey,
  type CompileEvent,
  type CompileRequest,
  type CompileRun,
  type CompileStage,
  type SessionOrio,
} from "@/lib/compileEvents";
import type { EpistemicClass } from "@/lib/evidence";
import { auditPublicSafeProjection, publicSafeCandidateFromRun } from "@/lib/disclosureAudit";
import { c2paEvidenceFromCredential } from "@/lib/c2paEvidence";

export type CompileDeps = {
  fetchSourceBytes: (sourceUrl: string, signal: AbortSignal) => Promise<Uint8Array>;
  sha256Hex: (value: string | Uint8Array) => Promise<string>;
  compileRecipe: (recipeSource: string, signal: AbortSignal) => Promise<RobbyIr>;
  inspectC2pa: (sourceName: string, signal: AbortSignal) => Promise<CredentialSignature>;
  renderReverse: (ir: RobbyIr, signal: AbortSignal) => Promise<EphemeralReverseResult>;
  now: () => string;
  createId: () => string;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  compilerVersion: string;
  rendererVersion: string;
};

export type CompileOptions = {
  force?: boolean;
};

type CachedOrio = {
  key: string;
  orio: SessionOrio;
};

export function createCompileController(deps: CompileDeps) {
  let active: CompileRun | null = null;
  let inflight: Promise<CompileRun> | null = null;
  let abort: AbortController | null = null;
  const cache = new Map<string, CachedOrio>();
  const listeners = new Set<(run: CompileRun) => void>();

  const snapshot = (run: CompileRun): CompileRun => ({
    ...run,
    events: run.events.slice(),
  });

  const notify = (run: CompileRun) => {
    const next = snapshot(run);
    listeners.forEach(listener => listener(next));
  };

  const emit = (
    run: CompileRun,
    stage: CompileStage,
    status: CompileEvent["status"],
    label: string,
    payload: Record<string, unknown> = {},
    classification?: EpistemicClass,
  ) => {
    run.events.push({
      compileRunId: run.id,
      sequence: run.events.length + 1,
      stage,
      status,
      timestamp: deps.now(),
      label,
      classification,
      payload,
    });
    notify(run);
  };

  const station = async (
    run: CompileRun,
    stage: CompileStage,
    classification: EpistemicClass | undefined,
    work: () => Promise<Record<string, unknown>>,
  ) => {
    emit(run, stage, "started", `${STATION_LABELS[stage]} started`);
    const payload = await work();
    emit(run, stage, "artifact", `${STATION_LABELS[stage]} artifact`, payload, classification);
    emit(run, stage, "completed", `${STATION_LABELS[stage]} completed`, payload, classification);
    return payload;
  };

  const cancelActive = () => {
    abort?.abort();
    if (active?.status === "running") {
      active.status = "cancelled";
      emit(active, active.events.at(-1)?.stage ?? "intake", "failed", "Run cancelled");
      notify(active);
    }
  };

  const compile = async (request: CompileRequest, options: CompileOptions = {}): Promise<CompileRun> => {
    if (!options.force && inflight && active?.status === "running" && active.galleryItemId === request.galleryItemId) {
      return active;
    }

    if (inflight) {
      cancelActive();
      try {
        await inflight;
      } catch {
        /* cancelled work is reported on the run object */
      }
    }

    const run: CompileRun = {
      id: deps.createId(),
      galleryItemId: request.galleryItemId,
      sourceName: request.sourceName,
      recipeSource: request.recipeSource,
      requestedAt: deps.now(),
      status: "running",
      events: [],
    };
    active = run;
    abort = new AbortController();
    const signal = abort.signal;
    notify(run);

    const execute = (async () => {
      try {
        const sourceBytes = await station(run, "intake", "measured", async () => {
          const bytes = await deps.fetchSourceBytes(request.sourceUrl, signal);
          const sourceByteSha256 = await deps.sha256Hex(bytes);
          return {
            sourceName: request.sourceName,
            byteSize: bytes.length,
            sourceByteSha256,
          };
        });

        const inspected = await deps.inspectC2pa(request.sourceName, signal);
        const c2paEvidence = c2paEvidenceFromCredential(inspected, deps.now());
        const readClass = inspected.status === "present" ? "verified" : "unavailable";
        const credential = await station(run, "read", readClass, async () => ({
          c2paStatus: inspected.status,
          c2paEvidence,
          verificationMethod: inspected.verificationMethod,
          note: inspected.note,
          gps: "private",
        }));

        await station(run, "measure", "measured", async () => ({
          sourceByteSha256: sourceBytes.sourceByteSha256,
          byteSize: sourceBytes.byteSize,
        }));

        const compiledIr = await deps.compileRecipe(request.recipeSource, signal);
        await station(run, "split", "derived", async () => ({
          method: "median_cut",
          paletteK: compiledIr.palette.k,
        }));

        const ir = await station(run, "declare", "declared", async () => ({
          irVersion: compiledIr.version,
          reverseMode: compiledIr.reverse.mode,
          paletteK: compiledIr.palette.k,
          recipeHash: compiledIr.meta.script_sha256,
        }));

        const binding = await station(run, "bind", "derived", async () => {
          const compilerVersion = deps.compilerVersion;
          const rendererVersion = deps.rendererVersion;
          const visibilityPolicyHash = await deps.sha256Hex("gps:private");
          const evidenceSelectionHash = await deps.sha256Hex(String(credential.c2paStatus));
          const canonicalRecipeHash = String(ir.recipeHash);
          const key = sessionCacheKey({
            galleryItemId: request.galleryItemId,
            sourceByteSha256: String(sourceBytes.sourceByteSha256),
            canonicalRecipeHash,
            visibilityPolicyHash,
            evidenceSelectionHash,
            compilerVersion,
            rendererVersion,
          });
          const sourceHash = String(sourceBytes.sourceByteSha256).replace(/[^0-9a-fA-F]/g, "").toUpperCase();
          return {
            key,
            objectBinding: `ORIO-${sourceHash.slice(0, 4)}-${sourceHash.slice(-4)}`,
            compilerVersion,
            rendererVersion,
            canonicalRecipeHash,
            sourceByteSha256: sourceBytes.sourceByteSha256,
            statement: "A reproducibility record, not an ownership certificate.",
          };
        });

        if (!options.force) {
          const cached = cache.get(String(binding.key));
          if (cached) {
            await station(run, "resolve", "derived", async () => ({
              reused: true,
              outputSha256: cached.orio.reverseOutputSha256,
              renderModule: cached.orio.renderModule,
            }));
            const orio: SessionOrio = {
              ...cached.orio,
              compileRunId: run.id,
              events: run.events,
              colourSwatches: cached.orio.colourSwatches ?? [],
              c2paEvidence: cached.orio.c2paEvidence,
            };
            await station(run, "marry", "derived", async () => ({
              objectId: orio.objectId,
              compileRunId: run.id,
            }));
            run.result = orio;
            run.status = "completed";
            notify(run);
            return run;
          }
        }

        const rendered = await station(run, "resolve", "derived", async () => {
          const result = await deps.renderReverse(compiledIr, signal);
          const reverseObjectUrl = deps.createObjectUrl(result.blob);
          return {
            reused: false,
            reverseObjectUrl,
            outputSha256: result.manifest.output_sha256,
            renderModule: result.manifest.render_module,
            derivedSeed: result.manifest.derived_seed,
            colourSwatches: result.manifest.colour_swatches,
          };
        });

        const splitEvent = run.events.findLast(event => event.stage === "split");
        if (splitEvent && Array.isArray(rendered.colourSwatches)) {
          splitEvent.payload = {
            ...splitEvent.payload,
            colourSwatches: rendered.colourSwatches,
          };
        }

        const colourSwatches = Array.isArray(rendered.colourSwatches) ? rendered.colourSwatches.map(String) : [];
        const disclosure = auditPublicSafeProjection(publicSafeCandidateFromRun({
          reverseMode: String(rendered.renderModule),
          colourSwatches,
          sourceByteSha256: String(sourceBytes.sourceByteSha256),
          recipeHash: String(binding.canonicalRecipeHash),
          reverseOutputSha256: String(rendered.outputSha256),
          gps: String(credential.gps ?? "private"),
          c2paStatus: String(credential.c2paStatus),
        }));
        const orio: SessionOrio = {
          objectId: `orio-${run.id}`,
          compileRunId: run.id,
          galleryItemId: request.galleryItemId,
          sourceByteSha256: String(sourceBytes.sourceByteSha256),
          recipeSource: request.recipeSource,
          canonicalRecipeHash: String(binding.canonicalRecipeHash),
          reverseObjectUrl: String(rendered.reverseObjectUrl),
          reverseOutputSha256: String(rendered.outputSha256),
          renderModule: String(rendered.renderModule),
          derivedSeed: String(rendered.derivedSeed),
          colourSwatches,
          c2paEvidence,
          compilerVersion: deps.compilerVersion,
          rendererVersion: deps.rendererVersion,
          events: run.events,
          createdAt: deps.now(),
          disclosure,
        };

        await station(run, "marry", "derived", async () => ({
          objectId: orio.objectId,
          compileRunId: run.id,
        }));

        const previous = cache.get(String(binding.key));
        if (previous && previous.orio.reverseObjectUrl !== orio.reverseObjectUrl) {
          deps.revokeObjectUrl(previous.orio.reverseObjectUrl);
        }
        cache.set(String(binding.key), { key: String(binding.key), orio });
        run.result = orio;
        run.status = "completed";
        notify(run);
        return run;
      } catch (error) {
        if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          run.status = "cancelled";
          run.diagnostic = "Run cancelled";
          notify(run);
          return run;
        }
        run.status = "failed";
        run.diagnostic = error instanceof Error ? error.message : String(error);
        emit(run, run.events.at(-1)?.stage ?? "intake", "failed", run.diagnostic);
        notify(run);
        return run;
      } finally {
        if (inflight && active?.id === run.id) {
          inflight = null;
          abort = null;
        }
      }
    })();

    inflight = execute;
    return execute;
  };

  return {
    compile,
    cancelActive,
    getActive: () => active,
    subscribe: (listener: (run: CompileRun) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { COMPILE_STAGES };
