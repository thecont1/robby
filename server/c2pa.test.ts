import { describe, expect, it } from "vitest";
import { credentialFromReaderSummary } from "./c2pa";

const sha256 = "a".repeat(64);

describe("credentialFromReaderSummary", () => {
  it("marks a structurally valid embedded manifest as present while retaining trust notices", () => {
    const result = credentialFromReaderSummary(sha256, {
      embedded: true,
      active: { claim_generator: "lightroom_classic/15.1" },
      validationState: "Valid",
      validationStatus: [{ code: "signingCredential.untrusted", explanation: "signing certificate untrusted" }],
    });

    expect(result).toMatchObject({
      status: "present",
      sourceSha256: sha256,
      claimGenerator: "lightroom_classic/15.1",
    });
    expect(result.note).toContain("signingCredential.untrusted");
  });

  it("does not treat a missing manifest as a marker-scan result", () => {
    const result = credentialFromReaderSummary(sha256, { embedded: false });

    expect(result.status).toBe("absent");
    expect(result.verificationMethod).toContain("C2PA Node SDK");
    expect(result.note).toContain("no embedded");
  });

  it("keeps an invalid embedded manifest distinct from absence", () => {
    const result = credentialFromReaderSummary(sha256, {
      embedded: true,
      active: { claim_generator: "editor/1.0" },
      validationState: "Invalid",
    });

    expect(result.status).toBe("candidate");
    expect(result.claimGenerator).toBe("editor/1.0");
  });
});
