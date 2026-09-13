import type { CompileEvent, CompileRun, CompileStage } from "@/lib/compileEvents";
import { COMPILE_STAGES, STATION_LABELS } from "@/lib/compileEvents";

export type CounterState = "dormant" | "primed" | "running" | "resolved" | "stale" | "failed";

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
  if (run.status === "failed" || run.status === "cancelled") return "failed";
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
      const status = String(payload.c2paStatus ?? "");
      const c2pa =
        status === "present" ? "C2PA VERIFIED" :
        status === "candidate" ? "C2PA CANDIDATE" :
        status === "checking" ? "C2PA CHECKING" :
        "C2PA UNAVAILABLE";
      const gps = payload.gps ? `GPS ${String(payload.gps).toUpperCase()}` : "";
      return [c2pa, gps].filter(Boolean).join(" · ");
    }
    case "measure": {
      const hash = typeof payload.sourceByteSha256 === "string" ? truncateHash(payload.sourceByteSha256) : "";
      return hash ? `PIXELS ${hash}` : STATION_LABELS.measure;
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
      const binding = String(payload.objectBinding ?? "").toUpperCase();
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
      label: latest ? stationSummary(stage, payload) : STATION_LABELS[stage],
      classification: latest?.classification,
      swatches: Array.isArray(payload.colourSwatches) ? payload.colourSwatches.map(String).slice(0, 16) : [],
    };
  });
}

export function counterCopy(state: CounterState) {
  switch (state) {
    case "dormant":
      return { kicker: "The counter is resting", body: "Turn this image to compile its reverse." };
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
  }
}
