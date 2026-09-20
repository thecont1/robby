import type { CompileEvent, CompileRun, CompileStage } from "@/lib/compileEvents";
import { COMPILE_STAGES, STATION_LABELS } from "@/lib/compileEvents";

export type CounterState = "dormant" | "primed" | "running" | "resolved" | "stale" | "failed" | "cancelled";

export type CounterPresentation = {
  showStations: boolean;
};

/**
 * The Teppanyaki Counter is an observability station: its eight stages remain
 * visible even before a run, so the user can see the full route the compiler
 * will take without opening a secondary disclosure.
 */
export function counterPresentation(state: CounterState): CounterPresentation {
  void state;
  return { showStations: true };
}

export type StationView = {
  stage: CompileStage;
  index: string;
  name: string;
  status: "idle" | "started" | "artifact" | "warning" | "completed" | "failed";
  label: string;
  classification?: string;
  swatches: string[];
};

export function deriveCounterState(run: CompileRun | null, recipeChanged: boolean): CounterState {
  if (!run) return recipeChanged ? "primed" : "dormant";
  if (run.status === "running") return "running";
  if (run.status === "cancelled") return "cancelled";
  if (run.status === "failed") return "failed";
  if (run.status === "completed") return recipeChanged ? "stale" : "resolved";
  return "dormant";
}

export function truncateHash(value: string) {
  const hex = value.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (hex.length < 8) return hex || "————";
  return `${hex.slice(0, 4)}…${hex.slice(-4)}`;
}

export function stationSummary(stage: CompileStage, payload: Record<string, unknown> = {}) {
  switch (stage) {
    case "intake": {
      const hash = typeof payload.sourceByteSha256 === "string" ? truncateHash(payload.sourceByteSha256) : "";
      const size = typeof payload.byteSize === "number" ? ` · ${payload.byteSize} B` : "";
      return hash ? `SOURCE ${hash}${size}` : STATION_LABELS.intake;
    }
    case "read": {
      const evidence = payload.c2paEvidence as { presence?: string; validation?: string; signerTrust?: string; availability?: string } | undefined;
      if (evidence) {
        const presence = String(evidence.presence ?? "absent").toUpperCase();
        const validation = String(evidence.validation ?? "unavailable").replace("_", " ").toUpperCase();
        const trust = evidence.signerTrust === "untrusted" ? "UNTRUSTED SIGNER" : evidence.signerTrust === "trusted" ? "TRUSTED SIGNER" : "SIGNER NOT ASSESSED";
        const availability = evidence.availability === "not_inspected" ? "NOT INSPECTED" : `${presence} · ${validation} · ${trust}`;
        const gps = payload.gps ? `GPS ${String(payload.gps).toUpperCase()}` : "";
        return [`C2PA ${availability}`, gps].filter(Boolean).join(" · ");
      }
      const status = String(payload.c2paStatus ?? "");
      const c2pa = status === "present" ? "C2PA VERIFIED" : status === "candidate" ? "C2PA CANDIDATE" : status === "checking" ? "C2PA CHECKING" : "C2PA UNAVAILABLE";
      const gps = payload.gps ? `GPS ${String(payload.gps).toUpperCase()}` : "";
      return [c2pa, gps].filter(Boolean).join(" · ");
    }
    case "measure": {
      const hash = typeof payload.pixelSha256 === "string" ? truncateHash(payload.pixelSha256) : "";
      return hash ? `PIXELS ${hash}` : "PIXELS UNAVAILABLE";
    }
    case "split": {
      const method = String(payload.method ?? "median_cut");
      const count = Array.isArray(payload.colourSwatches) ? payload.colourSwatches.length : 0;
      return count > 0 ? `PALETTE ${method} · ${count}` : `PALETTE ${method}`;
    }
    case "declare": {
      const mode = payload.reverseMode ? String(payload.reverseMode) : "";
      const k = payload.paletteK != null ? `k ${payload.paletteK}` : "";
      return ["MODE", mode, k].filter(Boolean).join(" · ").replace("MODE ·", "MODE");
    }
    case "bind": {
      // The authoritative digest is 64 hex characters; the counter shows the
      // same shortened form as every other hash on the strip.
      const raw = String(payload.objectBinding ?? "");
      const binding = raw ? truncateHash(raw) : "";
      return binding ? `${binding} · reproducibility record, not ownership` : STATION_LABELS.bind;
    }
    case "resolve": {
      const hash = typeof payload.outputSha256 === "string" ? truncateHash(payload.outputSha256) : "";
      const moduleName = payload.renderModule ? String(payload.renderModule) : "";
      return ["REVERSE", hash, moduleName].filter(Boolean).join(" · ").replace("REVERSE ·", "REVERSE");
    }
    case "marry":
      return payload.objectId ? String(payload.objectId) : STATION_LABELS.marry;
  }
}

export function stationViews(events: readonly CompileEvent[]): StationView[] {
  return COMPILE_STAGES.map((stage, index) => {
    const latest = [...events].reverse().find(event => event.stage === stage);
    const payload = latest?.payload ?? {};
    return {
      stage,
      index: String(index).padStart(2, "0"),
      name: STATION_LABELS[stage],
      status: latest?.status ?? "idle",
      // Keep the dormant instrument legible without repeating the station name
      // as its own placeholder description. Real payloads replace this copy.
      label: latest ? stationSummary(stage, payload) : "Awaiting compile",
      classification: latest?.classification,
      swatches: Array.isArray(payload.colourSwatches) ? payload.colourSwatches.map(String).slice(0, 64) : [],
    };
  });
}

export function counterCopy(state: CounterState) {
  switch (state) {
    case "dormant":
      return { kicker: "Resting", body: "Compile an orio to create this image's reverse." };
    case "primed":
      return { kicker: "Recipe ready", body: "Compile Orio to start a visible run." };
    case "running":
      return { kicker: "Compiling orio", body: "Stations are receiving the current run." };
    case "resolved":
      return { kicker: "Orio resolved", body: "This reverse belongs to the active obverse, recipe, evidence policy, and compiler runtime." };
    case "stale":
      return { kicker: "Orio stale", body: "The previous reverse no longer matches the current recipe." };
    case "failed":
      return { kicker: "Compile failed", body: "The obverse is unchanged. Fix the recipe or compile again." };
    case "cancelled":
      return { kicker: "Compile cancelled", body: "The obverse is unchanged and nothing was published. Compile again when you're ready." };
  }
}
