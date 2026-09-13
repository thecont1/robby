export type DisclosureCandidate = {
  reverseMode: string;
  colourSwatches: readonly string[];
  truncatedHashes: {
    source: string;
    pixels: string;
    recipe: string;
    reverse: string;
  };
  gps: string;
  c2paSummary: string;
  includeQuantisedObverse: boolean;
  includeSourcePixels: boolean;
  includeFilename: boolean;
  includeCaptureTime: boolean;
  includeFullHashes: boolean;
  includeRawMetadata: boolean;
};

export type DisclosureAudit = {
  safe: boolean;
  warnings: string[];
  omitted: string[];
};

const BOUNDED_GPS = new Set(["private", "redacted", "unavailable", "absent"]);

function looksLikeRawGps(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || BOUNDED_GPS.has(trimmed)) return false;
  return /[-+]?\d+(?:\.\d+)?\s*[,/]\s*[-+]?\d+(?:\.\d+)?/.test(trimmed) || /lat|lon|gps:/.test(trimmed);
}

export function auditPublicSafeProjection(candidate: DisclosureCandidate): DisclosureAudit {
  const omitted: string[] = [];
  const warnings: string[] = [];

  if (!candidate.includeSourcePixels) omitted.push("source pixels");
  else warnings.push("source pixels");

  if (!candidate.includeQuantisedObverse) omitted.push("quantised obverse");
  else warnings.push("quantised obverse");

  if (!candidate.includeFilename) omitted.push("filename");
  else warnings.push("filename");

  if (!candidate.includeCaptureTime) omitted.push("capture time");
  else warnings.push("capture time");

  if (!candidate.includeFullHashes) omitted.push("full hashes");
  else warnings.push("full hashes");

  if (!candidate.includeRawMetadata) omitted.push("raw metadata");
  else warnings.push("raw metadata");

  if (looksLikeRawGps(candidate.gps)) warnings.push("raw GPS");
  else omitted.push("raw GPS");

  return {
    safe: warnings.length === 0,
    warnings,
    omitted,
  };
}

export function publicSafeCandidateFromRun(input: {
  reverseMode: string;
  colourSwatches: readonly string[];
  sourceByteSha256: string;
  pixelSha256?: string;
  recipeHash: string;
  reverseOutputSha256: string;
  gps?: string;
  c2paStatus?: string;
}): DisclosureCandidate {
  const truncate = (value: string) => {
    const hex = value.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
    if (hex.length < 8) return hex || "————";
    return `${hex.slice(0, 4)}…${hex.slice(-4)}`;
  };
  const c2pa =
    input.c2paStatus === "present" ? "C2PA VERIFIED" :
    input.c2paStatus === "candidate" ? "C2PA CANDIDATE" :
    input.c2paStatus === "checking" ? "C2PA CHECKING" :
    "C2PA UNAVAILABLE";

  return {
    reverseMode: input.reverseMode,
    colourSwatches: input.colourSwatches,
    truncatedHashes: {
      source: truncate(input.sourceByteSha256),
      pixels: truncate(input.pixelSha256 ?? input.sourceByteSha256),
      recipe: truncate(input.recipeHash),
      reverse: truncate(input.reverseOutputSha256),
    },
    gps: input.gps ?? "private",
    c2paSummary: c2pa,
    includeQuantisedObverse: false,
    includeSourcePixels: false,
    includeFilename: false,
    includeCaptureTime: false,
    includeFullHashes: false,
    includeRawMetadata: false,
  };
}
