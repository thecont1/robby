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
};

export function deriveCounterState(run: CompileRun | null, recipeChanged: boolean): CounterState {
  if (!run) return recipeChanged ? "primed" : "dormant";
  if (run.status === "running") return "running";
  if (run.status === "failed" || run.status === "cancelled") return "failed";
  if (run.status === "completed") return recipeChanged ? "stale" : "resolved";
  return "dormant";
}

export function stationViews(events: readonly CompileEvent[]): StationView[] {
  return COMPILE_STAGES.map((stage, index) => {
    const latest = [...events].reverse().find(event => event.stage === stage);
    return {
      stage,
      index: String(index).padStart(2, "0"),
      name: STATION_LABELS[stage],
      status: latest?.status ?? "idle",
      label: latest?.label ?? STATION_LABELS[stage],
      classification: latest?.classification,
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
