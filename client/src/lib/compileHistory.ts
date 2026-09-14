import type { TraceStep } from "@/lib/demoData";
import type { RobbyIr } from "@/lib/robbyCompiler";

export type CompileSnapshot = {
  id: string;
  specimenId: string;
  source: string;
  ir: RobbyIr;
  trace: readonly TraceStep[];
  compiledAt: string;
  irHash: string;
  origin: "baseline" | "editor";
};

const MAX_SNAPSHOTS_PER_SPECIMEN = 12;
const sessionHistory = new Map<string, CompileSnapshot[]>();

export function sortCompileHistory(history: readonly CompileSnapshot[]) {
  return [...history].sort((left, right) => left.compiledAt.localeCompare(right.compiledAt));
}

/**
 * Phase 10 keeps compiler records in this browser session only. The async
 * surface is retained because Home already treats history as an asynchronous
 * data source, but no IndexedDB/localStorage write is permitted here.
 */
export async function loadCompileHistory(specimenId: string) {
  return sortCompileHistory(sessionHistory.get(specimenId) ?? []);
}

export async function persistCompileSnapshot(snapshot: CompileSnapshot) {
  const current = sessionHistory.get(snapshot.specimenId) ?? [];
  const withoutPriorId = current.filter(item => item.id !== snapshot.id);
  const bounded = sortCompileHistory([...withoutPriorId, snapshot]).slice(-MAX_SNAPSHOTS_PER_SPECIMEN);
  sessionHistory.set(snapshot.specimenId, bounded);
  return bounded.slice();
}
