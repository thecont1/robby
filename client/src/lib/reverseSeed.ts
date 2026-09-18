import type { C2paEvidence } from "@/lib/c2paEvidence";

export const FALLBACK_REVERSE_SEED = "42";

/**
 * C2PA-bearing originals get a seed from their active manifest label. This is
 * stable for the same credential and unique across normal C2PA manifests. A
 * source without an embedded/resolvable credential deliberately shares the
 * simple deterministic fallback requested by the artwork contract.
 */
export function reverseMotionSeed(evidence: Pick<C2paEvidence, "presence" | "credentialKey"> | null | undefined): string {
  if ((evidence?.presence === "present" || evidence?.presence === "candidate") && evidence.credentialKey?.trim()) {
    return evidence.credentialKey.trim();
  }
  return FALLBACK_REVERSE_SEED;
}
