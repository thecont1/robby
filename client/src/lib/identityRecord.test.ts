import { describe, expect, it } from "vitest";
import { buildIdentityRecord, identityLabel } from "./identityRecord";

describe("compiled identity record", () => {
  it("keeps source bytes, pixels, recipe, policy, binding, output, and run distinct", () => {
    const record = buildIdentityRecord({
      runId: "run-1",
      sourceByteSha256: "a".repeat(64),
      canonicalPixelSha256: null,
      authoredRecipeSha256: "b".repeat(64),
      canonicalRecipeSha256: "c".repeat(64),
      evidencePolicySha256: "d".repeat(64),
      objectBinding: "e".repeat(64),
      outputSha256: "f".repeat(64),
    });

    expect(record.sourceByteSha256).not.toBe(record.canonicalPixelSha256);
    expect(record.canonicalPixelSha256).toBeNull();
    expect(identityLabel(record, "pixels")).toBe("PIXELS UNAVAILABLE");
    expect(identityLabel(record, "binding")).toContain("BINDING EEEE");
  });

  it("does not call a source-derived digest pixels", () => {
    const record = buildIdentityRecord({
      runId: "run-2",
      sourceByteSha256: "a".repeat(64),
      canonicalPixelSha256: null,
      authoredRecipeSha256: "b".repeat(64),
      canonicalRecipeSha256: "c".repeat(64),
      evidencePolicySha256: "d".repeat(64),
      objectBinding: "e".repeat(64),
      outputSha256: "f".repeat(64),
    });
    expect(identityLabel(record, "source")).toContain("SOURCE BYTES");
    expect(identityLabel(record, "source")).not.toContain("PIXELS");
  });
});
