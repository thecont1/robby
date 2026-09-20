import type { EpistemicClass } from "@/lib/evidence";
import type { C2paEvidence } from "@/lib/c2paEvidence";
import type { IdentityRecord } from "@/lib/identityRecord";

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

/**
 * The counter rail and the station pipeline share one pace: each station
 * holds for at least this long before completing, and the rail head crosses
 * one cell in the same interval — so the process itself waits for the rail
 * instead of letting events outrun it.
 */
export const STATION_PACE_MS = 1180;

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
  /** GPS-seeded coarse terrain for the reverse face — null without GPS evidence. */
  terrain: { representation: string; grid_size: number; heights: number[] } | null;
  c2paEvidence: C2paEvidence;
  identity: IdentityRecord;
  compilerVersion: string;
  rendererVersion: string;
  events: CompileEvent[];
  createdAt: string;
  disclosure: {
    safe: boolean;
    warnings: string[];
    omitted: string[];
  };
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
  read: "Observe",
  measure: "Measure",
  split: "Split",
  declare: "Declare",
  bind: "Bind",
  resolve: "Resolve",
  marry: "Marry",
};

export function sessionCacheKey(parts: {
  bindingSha256: string;
}) {
  // Plan 9B: the session cache is keyed by the authoritative binding digest
  // alone; the full identity tuple is re-verified on retrieval.
  return `robby-session-orio-v1:${parts.bindingSha256}`;
}

export function identityTupleMatches(cached: {
  galleryItemId: string;
  sourceByteSha256: string;
  pixelSha256: string;
  canonicalRecipeHash: string;
  visibilityPolicyHash: string;
  evidenceSelectionHash: string;
  compilerVersion: string;
  rendererVersion: string;
  bindingSha256: string;
}, candidate: {
  galleryItemId: string;
  sourceByteSha256: string;
  pixelSha256: string;
  canonicalRecipeHash: string;
  visibilityPolicyHash: string;
  evidenceSelectionHash: string;
  compilerVersion: string;
  rendererVersion: string;
  bindingSha256: string;
}) {
  return (
    cached.galleryItemId === candidate.galleryItemId &&
    cached.sourceByteSha256 === candidate.sourceByteSha256 &&
    cached.pixelSha256 === candidate.pixelSha256 &&
    cached.canonicalRecipeHash === candidate.canonicalRecipeHash &&
    cached.visibilityPolicyHash === candidate.visibilityPolicyHash &&
    cached.evidenceSelectionHash === candidate.evidenceSelectionHash &&
    cached.compilerVersion === candidate.compilerVersion &&
    cached.rendererVersion === candidate.rendererVersion &&
    cached.bindingSha256 === candidate.bindingSha256
  );
}
