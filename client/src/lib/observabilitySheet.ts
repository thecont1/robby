import type { C2paEvidence } from "@/lib/c2paEvidence";
import { c2paEvidenceLabel } from "@/lib/c2paEvidence";
import type { IntakeManifest } from "@/lib/robbyCompiler";

/** Public-safe facts the observability sheet may render. Mirrors Rust `SheetFacts`. */
export type ObservabilitySheetFacts = {
  run_id: string | null;
  binding_short_id: string | null;
  source_sha256: string | null;
  pixel_sha256: string | null;
  recipe_sha256: string | null;
  palette_k: number | null;
  reverse_mode: string | null;
  ir_schema: string | null;
  policy_name: string | null;
  evidence: {
    exif: string | null;
    iptc: string | null;
    xmp: string | null;
    gps: string | null;
    c2pa: string | null;
  };
  included: string[];
  withheld: string[];
};

const DEFAULT_INCLUDED = [
  "Palette",
  "binding mark",
  "recipe parameters",
  "evidence states",
];

function shortRunId(runId: string) {
  const compact = runId.replace(/[^0-9a-zA-Z]/g, "");
  const body = compact.replace(/^run/i, "") || compact;
  return body.slice(0, 8).toUpperCase();
}

function metadataState(field: { classification?: string; state?: string } | undefined, presentLabel: string) {
  const state = String(field?.state ?? "").toLowerCase();
  if (state === "present") return presentLabel;
  return "UNAVAILABLE";
}

function c2paState(evidence: C2paEvidence) {
  if (evidence.availability === "not_inspected") return "NOT INSPECTED";
  return c2paEvidenceLabel(evidence).replace(/^C2PA\s+/, "");
}

export function buildObservabilitySheetFacts(input: {
  runId: string;
  bindingShortId: string;
  sourceByteSha256: string;
  pixelSha256: string;
  canonicalRecipeSha256: string;
  paletteK: number;
  reverseMode: string;
  irSchema: string;
  intake?: IntakeManifest;
  c2paEvidence: C2paEvidence;
  omitted: readonly string[];
}): ObservabilitySheetFacts {
  const evidence = input.intake?.evidence;
  return {
    run_id: shortRunId(input.runId),
    binding_short_id: input.bindingShortId,
    source_sha256: input.sourceByteSha256,
    pixel_sha256: input.pixelSha256,
    recipe_sha256: input.canonicalRecipeSha256,
    palette_k: input.paletteK,
    reverse_mode: input.reverseMode,
    ir_schema: input.irSchema,
    policy_name: "robby-v1-default-disclosure-policy",
    evidence: {
      exif: metadataState(evidence?.exif, "OBSERVED"),
      iptc: metadataState(evidence?.iptc, "OBSERVED"),
      xmp: metadataState(evidence?.xmp, "OBSERVED"),
      gps: metadataState(evidence?.gps, "REDACTED"),
      c2pa: c2paState(input.c2paEvidence),
    },
    included: [...DEFAULT_INCLUDED],
    withheld: [...input.omitted],
  };
}
