import type { CredentialSignature } from "@/lib/demoData";
import type { IntakeManifest, RobbyIr } from "@/lib/robbyCompiler";
import type { EphemeralReverseResult } from "@/lib/liveRender";
import { buildObservabilitySheetFacts, type ObservabilitySheetFacts } from "@/lib/observabilitySheet";
import {
  COMPILE_STAGES,
  STATION_LABELS,
  identityTupleMatches,
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
import { buildIdentityRecord } from "@/lib/identityRecord";

export type SourceIntake = {
  sourceByteSha256: string;
  pixelSha256: string;
  width: number;
  height: number;
  orientation: number | null;
  mimeType: string;
  intakeVersion: string;
  manifest: IntakeManifest;
};

export type CanonicalBinding = {
  bindingSha256: string;
  shortId: string;
  recipeIrSchema: string;
  sourceByteSha256: string;
  canonicalPixelSha256: string;
  authoredRecipeSha256: string;
  canonicalRecipeSha256: string;
  disclosurePolicySha256: string;
  selectedEvidenceSha256: string;
  compilerVersion: string;
  rendererVersion: string;
  statement: string;
};

export type CompileDeps = {
  fetchSourceBytes: (sourceUrl: string, signal: AbortSignal) => Promise<Uint8Array>;
  sha256Hex: (value: string | Uint8Array) => Promise<string>;
  measureSourceBytes: (originalName: string, bytes: Uint8Array, signal: AbortSignal) => Promise<SourceIntake>;
  buildBinding: (
    intakeManifestJson: string,
    recipeSource: string,
    evidence: { schema: string; c2pa: { presence: string; validation: string; signerTrust: string; availability: string } },
    compilerVersion: string,
    rendererVersion: string,
  ) => Promise<CanonicalBinding>;
  compileRecipe: (recipeSource: string, signal: AbortSignal) => Promise<RobbyIr>;
  inspectC2pa: (
    sourceName: string,
    bytes: Uint8Array,
    sourceByteSha256: string,
    signal: AbortSignal,
  ) => Promise<CredentialSignature>;
  renderReverse: (ir: RobbyIr, signal: AbortSignal, sheet?: ObservabilitySheetFacts) => Promise<EphemeralReverseResult>;
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

async function inspectOptionalC2pa(
  deps: CompileDeps,
  sourceName: string,
  bytes: Uint8Array,
  sourceByteSha256: string,
  signal: AbortSignal,
): Promise<CredentialSignature> {
  try {
    return await deps.inspectC2pa(sourceName, bytes, sourceByteSha256, signal);
  } catch (error) {
    if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "absent",
      sourceSha256: sourceByteSha256,
      verificationMethod: "Official CAI C2PA Node SDK validation of exact local JPEG bytes",
      note: `The official C2PA reader could not inspect this JPEG. Compilation continues without C2PA evidence. ${message}`,
    };
  }
}

type CachedOrio = {
  key: string;
  orio: SessionOrio;
  tuple: {
    galleryItemId: string;
    sourceByteSha256: string;
    pixelSha256: string;
    canonicalRecipeHash: string;
    visibilityPolicyHash: string;
    evidenceSelectionHash: string;
    compilerVersion: string;
    rendererVersion: string;
    bindingSha256: string;
  };
};

export function createCompileController(deps: CompileDeps) {
  let active: CompileRun | null = null;
  let activeRequestKey: string | null = null;
  let inflight: Promise<CompileRun> | null = null;
  let abort: AbortController | null = null;
  const cache = new Map<string, CachedOrio>();
  const runReverseUrls = new Map<string, string>();
  const listeners = new Set<(run: CompileRun) => void>();

  // Two callers coalesce onto one run only when every request field matches.
  // Keying on galleryItemId alone would silently drop a changed recipe or a
  // changed source and hand back a run compiled from stale input.
  const requestKey = (request: CompileRequest) => JSON.stringify([
    request.galleryItemId,
    request.sourceName,
    request.sourceUrl,
    request.recipeSource,
  ]);

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
      // Plan 9B: a cancelled run must not leak the Blob URL it created
      // mid-flight; partial output is discarded, not unlocked.
      const leakedUrl = runReverseUrls.get(active.id);
      if (leakedUrl) {
        runReverseUrls.delete(active.id);
        deps.revokeObjectUrl(leakedUrl);
      }
      emit(active, active.events.at(-1)?.stage ?? "intake", "failed", "Run cancelled");
      notify(active);
    }
  };

  const dispose = () => {
    cancelActive();
    // Revoke every session-cached reverse URL, then drop the cache so
    // nothing can retrieve a revoked URL.
    cache.forEach(entry => {
      deps.revokeObjectUrl(entry.orio.reverseObjectUrl);
    });
    cache.clear();
  };

  const compile = async (request: CompileRequest, options: CompileOptions = {}): Promise<CompileRun> => {
    const key = requestKey(request);
    if (!options.force && inflight && active?.status === "running" && activeRequestKey === key) {
      // Identical caller: await the same run rather than receive a
      // half-finished run object. A changed recipe or source yields a
      // different key and starts its own run below.
      return inflight;
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
    activeRequestKey = key;
    abort = new AbortController();
    const signal = abort.signal;
    notify(run);

    const execute = (async () => {
      try {
        // The raw source bytes stay in this private local. They are never
        // returned through `station`, so they never enter run.events, the
        // published SessionOrio, or the session cache — only bounded intake
        // facts (name, size, digest) are observable.
        let sourceByteArray: Uint8Array | null = null;
        const sourceBytes = await station(run, "intake", "measured", async () => {
          const bytes = await deps.fetchSourceBytes(request.sourceUrl, signal);
          sourceByteArray = bytes;
          const sourceByteSha256 = await deps.sha256Hex(bytes);
          return {
            sourceName: request.sourceName,
            byteSize: bytes.length,
            sourceByteSha256,
          };
        });

        if (!sourceByteArray) throw new Error("Source bytes were not read during intake.");
        const inspectedRaw = await inspectOptionalC2pa(
          deps,
          request.sourceName,
          sourceByteArray,
          String(sourceBytes.sourceByteSha256),
          signal,
        );
        const inspected = inspectedRaw.sourceSha256.toLowerCase() === String(sourceBytes.sourceByteSha256).toLowerCase()
          ? inspectedRaw
          : {
              status: "absent" as const,
              sourceSha256: String(sourceBytes.sourceByteSha256),
              verificationMethod: inspectedRaw.verificationMethod,
              note: "The C2PA reader could not inspect a matching source: its result does not match the intake source. Compilation continues without C2PA evidence.",
            };
        const c2paEvidence = c2paEvidenceFromCredential(inspected, deps.now());
        const readClass = inspected.status === "present" ? "verified" : "unavailable";
        const credential = await station(run, "read", readClass, async () => ({
          c2paStatus: inspected.status,
          c2paEvidence,
          verificationMethod: inspected.verificationMethod,
          note: inspected.note,
          gps: "private",
        }));

        const intake = await station(run, "measure", "measured", async () => {
          if (!sourceByteArray) throw new Error("Source bytes were not read during intake.");
          const measurement = await deps.measureSourceBytes(request.sourceName, sourceByteArray, signal);
          if (measurement.sourceByteSha256.toLowerCase() !== String(sourceBytes.sourceByteSha256).toLowerCase()) {
            throw new Error("Rust intake source SHA-256 does not match the fetched source bytes.");
          }
          return {
            sourceByteSha256: measurement.sourceByteSha256,
            byteSize: sourceBytes.byteSize,
            pixelSha256: measurement.pixelSha256,
            width: measurement.width,
            height: measurement.height,
            orientation: measurement.orientation,
            mimeType: measurement.mimeType,
            intakeVersion: measurement.intakeVersion,
            intakeManifestJson: JSON.stringify(measurement.manifest),
          };
        });

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
          // P9A.6: the authoritative binding is produced by Rust/WASM. The
          // browser never composites its own binding and never falls back to
          // an alternate algorithm.
          const record = await deps.buildBinding(
            String(intake.intakeManifestJson),
            request.recipeSource,
            {
              schema: "robby-evidence-selection-v1",
              c2pa: {
                presence: String(inspected.status === "present" || inspected.status === "candidate" ? inspected.status : "absent"),
                validation: String(c2paEvidence.validation),
                signerTrust: String(c2paEvidence.signerTrust),
                availability: String(c2paEvidence.availability),
              },
            },
            deps.compilerVersion,
            deps.rendererVersion,
          );
          const key = sessionCacheKey({
            bindingSha256: record.bindingSha256,
          });
          return {
            key,
            objectBinding: record.bindingSha256,
            shortId: record.shortId,
            recipeIrSchema: record.recipeIrSchema,
            compilerVersion: record.compilerVersion,
            rendererVersion: record.rendererVersion,
            canonicalRecipeHash: record.canonicalRecipeSha256,
            authoredRecipeSha256: record.authoredRecipeSha256,
            sourceByteSha256: record.sourceByteSha256,
            pixelSha256: record.canonicalPixelSha256,
            visibilityPolicyHash: record.disclosurePolicySha256,
            evidenceSelectionHash: record.selectedEvidenceSha256,
            statement: record.statement,
          };
        });

        if (!options.force) {
          const cached = cache.get(String(binding.key));
          if (cached && identityTupleMatches(
            {
              galleryItemId: request.galleryItemId,
              sourceByteSha256: String(binding.sourceByteSha256),
              pixelSha256: String(binding.pixelSha256),
              canonicalRecipeHash: String(binding.canonicalRecipeHash),
              visibilityPolicyHash: String(binding.visibilityPolicyHash),
              evidenceSelectionHash: String(binding.evidenceSelectionHash),
              compilerVersion: String(binding.compilerVersion),
              rendererVersion: String(binding.rendererVersion),
              bindingSha256: String(binding.objectBinding),
            },
            {
              ...cached.tuple,
            },
          )) {
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
              // The reused orio belongs to THIS run: its identity record must
              // name the current runId, not the run that first produced it,
              // so compileRunId and identity.runId never disagree.
              identity: { ...cached.orio.identity, runId: run.id },
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
          let intakeManifest: IntakeManifest | undefined;
          try {
            intakeManifest = JSON.parse(String(intake.intakeManifestJson)) as IntakeManifest;
          } catch {
            intakeManifest = undefined;
          }
          const provisionalDisclosure = auditPublicSafeProjection(publicSafeCandidateFromRun({
            reverseMode: String(compiledIr.reverse.mode),
            colourSwatches: [],
            sourceByteSha256: String(sourceBytes.sourceByteSha256),
            recipeHash: String(binding.canonicalRecipeHash),
            reverseOutputSha256: "",
            gps: String(credential.gps ?? "private"),
            c2paStatus: String(credential.c2paStatus),
          }));
          const sheet = buildObservabilitySheetFacts({
            runId: run.id,
            bindingShortId: String(binding.shortId),
            sourceByteSha256: String(binding.sourceByteSha256),
            pixelSha256: String(binding.pixelSha256),
            canonicalRecipeSha256: String(binding.canonicalRecipeHash),
            paletteK: Number(compiledIr.palette.k),
            reverseMode: String(compiledIr.reverse.mode),
            irSchema: String(binding.recipeIrSchema ?? compiledIr.version),
            intake: intakeManifest,
            c2paEvidence,
            omitted: provisionalDisclosure.omitted,
          });
          const result = await deps.renderReverse(compiledIr, signal, sheet);
          // Plan 9B: if this run was cancelled while the renderer worked, the
          // freshly created URL must be revoked immediately — partial output
          // is never unlocked.
          if (run.status === "cancelled" || signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          const reverseObjectUrl = deps.createObjectUrl(result.blob);
          runReverseUrls.set(run.id, reverseObjectUrl);
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
        const identity = buildIdentityRecord({
          runId: run.id,
          sourceByteSha256: String(binding.sourceByteSha256),
          canonicalPixelSha256: String(binding.pixelSha256),
          authoredRecipeSha256: String(binding.authoredRecipeSha256),
          canonicalRecipeSha256: String(binding.canonicalRecipeHash),
          evidencePolicySha256: String(binding.visibilityPolicyHash),
          objectBinding: String(binding.objectBinding),
          outputSha256: String(rendered.outputSha256),
        });
        const bindEvent = run.events.findLast(event => event.stage === "bind" && event.status === "completed");
        if (bindEvent) bindEvent.payload = { ...bindEvent.payload, objectBinding: identity.objectBinding };
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
          identity: buildIdentityRecord({
            runId: run.id,
            sourceByteSha256: String(sourceBytes.sourceByteSha256),
            canonicalPixelSha256: String(binding.pixelSha256),
            authoredRecipeSha256: String(binding.authoredRecipeSha256),
            canonicalRecipeSha256: String(binding.canonicalRecipeHash),
            evidencePolicySha256: String(binding.visibilityPolicyHash),
            objectBinding: String(binding.objectBinding),
            outputSha256: String(rendered.outputSha256),
          }),
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
        cache.set(String(binding.key), {
          key: String(binding.key),
          orio,
          tuple: {
            galleryItemId: request.galleryItemId,
            sourceByteSha256: String(binding.sourceByteSha256),
            pixelSha256: String(binding.pixelSha256),
            canonicalRecipeHash: String(binding.canonicalRecipeHash),
            visibilityPolicyHash: String(binding.visibilityPolicyHash),
            evidenceSelectionHash: String(binding.evidenceSelectionHash),
            compilerVersion: String(binding.compilerVersion),
            rendererVersion: String(binding.rendererVersion),
            bindingSha256: String(binding.objectBinding),
          },
        });
        run.result = orio;
        run.status = "completed";
        notify(run);
        return run;
      } catch (error) {
        if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          run.status = "cancelled";
          run.diagnostic = "Run cancelled";
          // A URL may have been created between cancel and the abort landing;
          // it must never leak.
          const lateUrl = runReverseUrls.get(run.id);
          if (lateUrl) {
            runReverseUrls.delete(run.id);
            deps.revokeObjectUrl(lateUrl);
          }
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
          activeRequestKey = null;
        }
      }
    })();

    inflight = execute;
    return execute;
  };

  return {
    compile,
    cancelActive,
    dispose,
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
