export type IdentityRecord = {
  runId: string;
  sourceByteSha256: string;
  canonicalPixelSha256: string | null;
  authoredRecipeSha256: string;
  canonicalRecipeSha256: string;
  evidencePolicySha256: string;
  objectBinding: string;
  outputSha256: string;
};

export type IdentityInput = IdentityRecord;

function short(value: string) {
  const hex = value.replace(/[^0-9a-f]/gi, "").toUpperCase();
  return hex.length >= 8 ? `${hex.slice(0, 4)}…${hex.slice(-4)}` : hex || "UNAVAILABLE";
}

export function buildIdentityRecord(input: IdentityInput): IdentityRecord {
  return { ...input };
}

export function identityLabel(record: IdentityRecord, kind: "source" | "pixels" | "recipe" | "policy" | "binding" | "output" | "run") {
  switch (kind) {
    case "source": return `SOURCE BYTES ${short(record.sourceByteSha256)}`;
    case "pixels": return record.canonicalPixelSha256 ? `PIXELS ${short(record.canonicalPixelSha256)}` : "PIXELS UNAVAILABLE";
    case "recipe": return `RECIPE ${short(record.canonicalRecipeSha256)}`;
    case "policy": return `POLICY ${short(record.evidencePolicySha256)}`;
    case "binding": return `BINDING ${short(record.objectBinding)}`;
    case "output": return `OUTPUT ${short(record.outputSha256)}`;
    case "run": return `RUN ${record.runId}`;
  }
}
