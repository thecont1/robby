import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { credentialFromReaderSummary, inspectGalleryCredential, unavailableCredentialInspection } from "./c2pa";
import { createApp } from "./_core/index";

const sha256 = "a".repeat(64);
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

async function testServer() {
  const server = createServer(createApp({ serveFrontend: false }));
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test server address");
  return `http://127.0.0.1:${address.port}`;
}

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

describe("compile-run C2PA byte boundary", () => {
  it("inspects the posted intake snapshot and returns the same digest with no-store", async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const base = await testServer();

    const response = await fetch(`${base}/api/c2pa/source.jpg`, {
      method: "POST",
      headers: {
        "Content-Type": "image/jpeg",
        "X-Robby-Source-SHA256": digest,
      },
      body: bytes,
    });
    const result = await response.json() as { sourceSha256: string; note: string };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(result.sourceSha256).toBe(digest);
    // This minimal JPEG may be unsupported by the SDK; unavailability is an
    // honest successful inspection result, not a transport failure.
    expect(result.note.length).toBeGreaterThan(0);
  });

  it("rejects posted bytes whose digest differs from intake", async () => {
    const base = await testServer();
    const response = await fetch(`${base}/api/c2pa/source.jpg`, {
      method: "POST",
      headers: {
        "Content-Type": "image/jpeg",
        "X-Robby-Source-SHA256": "00".repeat(32),
      },
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("do not match the intake SHA-256"),
    });
  });

  it.each([
    ["missing digest", {}],
    ["invalid digest", { "X-Robby-Source-SHA256": "not-a-digest" }],
  ])("rejects %s", async (_label, headers) => {
    const base = await testServer();
    const response = await fetch(`${base}/api/c2pa/source.jpg`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg", ...headers },
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    expect(response.status).toBe(400);
  });
});

describe("optional C2PA inspection failures", () => {
  it("classifies unsupported C2PA SDK errors as unavailable instead of throwing", () => {
    const result = unavailableCredentialInspection("a".repeat(64), new Error("type is unsupported"));
    expect(result.status).toBe("absent");
    expect(result.note).toContain("type is unsupported");
    expect(result.verificationMethod).toContain("C2PA Node SDK");
  });
});
