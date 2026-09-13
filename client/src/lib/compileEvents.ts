import type { EpistemicClass } from "@/lib/evidence";

export const COMPILE_STAGES = [
  "intake",
  "read",
  "measure",
  "split",
  "declare",
  "bind",
  "resolve",
  "marry",
] as const;

export type CompileStage = (typeof COMPILE_STAGES)[number];

export type CompileEventStatus = "started" | "artifact" | "warning" | "completed" | "failed";

export type CompileEvent = {
  compileRunId: string;
  sequence: number;
  stage: CompileStage;
  status: CompileEventStatus;
  timestamp: string;
  label: string;
  classification?: EpistemicClass;
  payload: Record<string, unknown>;
};

export type CompileRunStatus = "running" | "completed" | "failed" | "cancelled";

export type CompileRequest = {
  galleryItemId: string;
  sourceName: string;
  sourceUrl: string;
  recipeSource: string;
};

export type SessionOrio = {
  objectId: string;
  compileRunId: string;
  galleryItemId: string;
  sourceByteSha256: string;
  recipeSource: string;
  canonicalRecipeHash: string;
  reverseObjectUrl: string;
  reverseOutputSha256: string;
  renderModule: string;
  derivedSeed: string;
  colourSwatches: string[];
  compilerVersion: string;
  rendererVersion: string;
  events: CompileEvent[];
  createdAt: string;
};

export type CompileRun = {
  id: string;
  galleryItemId: string;
  sourceName: string;
  recipeSource: string;
  requestedAt: string;
  status: CompileRunStatus;
  events: CompileEvent[];
  result?: SessionOrio;
  diagnostic?: string;
};

export const STATION_LABELS: Record<CompileStage, string> = {
  intake: "Intake",
  read: "Read",
  measure: "Measure",
  split: "Split",
  declare: "Declare",
  bind: "Bind",
  resolve: "Resolve",
  marry: "Marry",
};

export function sessionCacheKey(parts: {
  galleryItemId: string;
  sourceByteSha256: string;
  canonicalRecipeHash: string;
  visibilityPolicyHash: string;
  evidenceSelectionHash: string;
  compilerVersion: string;
  rendererVersion: string;
}) {
  return [
    parts.galleryItemId,
    parts.sourceByteSha256,
    parts.canonicalRecipeHash,
    parts.visibilityPolicyHash,
    parts.evidenceSelectionHash,
    parts.compilerVersion,
    parts.rendererVersion,
  ].join("|");
}
