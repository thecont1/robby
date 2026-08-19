import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLocalGallerySource } from "./gallerySource";

describe("local gallery source resolution", () => {
  it("returns the exact bytes and SHA-256 for a watched JPEG", async () => {
    const root = mkdtempSync(join(tmpdir(), "robby-gallery-source-"));
    try {
      const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);
      writeFileSync(join(root, "specimen.jpg"), bytes);

      const source = await readLocalGallerySource("specimen.jpg", root);

      expect(source.bytes).toEqual(bytes);
      expect(source.sha256).toBe("1a6a985dd898be7f6a5315231045c87a72d7044cb7527c06131f8af9d0dc0647");
      expect(source.filename).toBe("specimen.jpg");
      expect(source.path).toBe(join(root, "specimen.jpg"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    "../outside.jpg",
    "nested/specimen.jpg",
    "/tmp/specimen.jpg",
    "specimen.png",
    "",
  ])("rejects unsafe or unsupported source %j", async candidate => {
    const root = mkdtempSync(join(tmpdir(), "robby-gallery-source-"));
    try {
      await expect(readLocalGallerySource(candidate, root)).rejects.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects missing files and directories", async () => {
    const root = mkdtempSync(join(tmpdir(), "robby-gallery-source-"));
    mkdirSync(join(root, "folder.jpg"));
    try {
      await expect(readLocalGallerySource("missing.jpg", root)).rejects.toThrow("not found");
      await expect(readLocalGallerySource("folder.jpg", root)).rejects.toThrow("regular file");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a JPEG symlink that resolves outside the gallery root", async () => {
    const root = mkdtempSync(join(tmpdir(), "robby-gallery-source-"));
    const outside = mkdtempSync(join(tmpdir(), "robby-gallery-outside-"));
    try {
      writeFileSync(join(outside, "secret.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
      symlinkSync(join(outside, "secret.jpg"), join(root, "linked.jpg"));

      await expect(readLocalGallerySource("linked.jpg", root)).rejects.toThrow("symlink");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
