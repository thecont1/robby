import { describe, expect, it } from "vitest";
import { c2paEvidenceFromCredential, c2paEvidenceLabel } from "./c2paEvidence";

describe("run-bound C2PA evidence", () => {
  it("keeps valid content distinct from signer trust", () => {
    const evidence = c2paEvidenceFromCredential({
      status: "present",
      sourceSha256: "a".repeat(64),
      verificationMethod: "Official CAI C2PA Node SDK validation",
      note: "Validation state: Valid. Validation notices: signingCredential.untrusted: signing certificate untrusted.",
    }, "2026-09-13T22:00:00.000Z");
    expect(evidence.validation).toBe("valid");
    expect(evidence.signerTrust).toBe("untrusted");
    expect(c2paEvidenceLabel(evidence)).toBe("C2PA PRESENT · VALID · UNTRUSTED SIGNER");
  });

  it("represents an inspected missing manifest as absent, not not-inspected", () => {
    const evidence = c2paEvidenceFromCredential({
      status: "absent",
      sourceSha256: "b".repeat(64),
      verificationMethod: "Official CAI C2PA Node SDK validation",
      note: "The official C2PA reader found no embedded manifest.",
    }, "2026-09-13T22:00:00.000Z");
    expect(evidence.presence).toBe("absent");
    expect(evidence.availability).toBe("inspected");
    expect(c2paEvidenceLabel(evidence)).toBe("C2PA ABSENT · UNAVAILABLE · SIGNER NOT ASSESSED");
  });
});
