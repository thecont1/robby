import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { credentialFromReaderSummary, inspectGalleryCredential } from "./c2pa";

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

describe("C2PA gallery source boundary", () => {
  it("uses the configured gallery root", async () => {
    const root = mkdtempSync(join(tmpdir(), "robby-c2pa-gallery-"));
    const previous = process.env.ROBBY_GALLERY_DIR;
    process.env.ROBBY_GALLERY_DIR = root;
    try {
      await expect(inspectGalleryCredential("MS202401-Ayodhya0041.jpg")).rejects.toThrow("not found");
    } finally {
      if (previous === undefined) delete process.env.ROBBY_GALLERY_DIR;
      else process.env.ROBBY_GALLERY_DIR = previous;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a gallery symlink before credential inspection", async () => {
    const root = mkdtempSync(join(tmpdir(), "robby-c2pa-gallery-"));
    const outside = mkdtempSync(join(tmpdir(), "robby-c2pa-outside-"));
    const previous = process.env.ROBBY_GALLERY_DIR;
    process.env.ROBBY_GALLERY_DIR = root;
    try {
      writeFileSync(join(outside, "outside.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
      symlinkSync(join(outside, "outside.jpg"), join(root, "linked.jpg"));
      await expect(inspectGalleryCredential("linked.jpg")).rejects.toThrow("symlink");
    } finally {
      if (previous === undefined) delete process.env.ROBBY_GALLERY_DIR;
      else process.env.ROBBY_GALLERY_DIR = previous;
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
