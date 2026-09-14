import { describe, expect, it } from "vitest";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { renderEphemeralReverse } from "./liveRender";

const validIr = (source: string) => ({
  version: "robby-ir-v1",
  canvas: { base: source, width: null, height: null },
  palette: { k: 8 },
  reverse: { mode: "negative" },
  output: { obverse: "front.png", reverse: "transient", manifest: "transient" },
  meta: { script_sha256: "a".repeat(64) },
});

describe("local live-render source boundary", () => {
  it.each([
    ["reverse_mode", { reverse_mode: "observability_sheet" }, "reverse_mode"],
    ["palette_k", { palette_k: 9 }, "palette_k"],
    ["ir_schema", { ir_schema: "robby-ir-v2" }, "ir_schema"],
  ])("rejects conflicting sheet %s before source lookup", async (_label, conflict, expected) => {
    await expect(renderEphemeralReverse(validIr("missing.jpg"), {
      evidence: { exif: null, iptc: null, xmp: null, gps: null, c2pa: null },
      included: [],
      withheld: [],
      ...conflict,
    })).rejects.toThrow(expected);
  });

  it("rejects a JPEG that is not present in the watched gallery folder", async () => {
    const root = mkdtempSync(join(tmpdir(), "robby-live-source-"));
    const previous = process.env.ROBBY_GALLERY_DIR;
    process.env.ROBBY_GALLERY_DIR = root;
    try {
      await expect(renderEphemeralReverse(validIr("missing.jpg"))).rejects.toThrow("Gallery source not found: missing.jpg");
    } finally {
      if (previous === undefined) delete process.env.ROBBY_GALLERY_DIR;
      else process.env.ROBBY_GALLERY_DIR = previous;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects traversal before invoking the executor", async () => {
    const root = mkdtempSync(join(tmpdir(), "robby-live-source-"));
    const previous = process.env.ROBBY_GALLERY_DIR;
    process.env.ROBBY_GALLERY_DIR = root;
    try {
      writeFileSync(join(root, "safe.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
      await expect(renderEphemeralReverse(validIr("../safe.jpg"))).rejects.toThrow("basename");
    } finally {
      if (previous === undefined) delete process.env.ROBBY_GALLERY_DIR;
      else process.env.ROBBY_GALLERY_DIR = previous;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("leaves the watched source folder byte-identical after a live reverse", async () => {
    const root = mkdtempSync(join(tmpdir(), "robby-live-source-"));
    const previous = process.env.ROBBY_GALLERY_DIR;
    process.env.ROBBY_GALLERY_DIR = root;
    try {
      const sourcePath = join(root, "safe.jpg");
      copyFileSync(resolve(process.cwd(), "tests", "fixtures", "render-source.jpg"), sourcePath);
      const beforeHash = createHash("sha256").update(readFileSync(sourcePath)).digest("hex");
      const beforeNames = readdirSync(root).sort();

      const result = await renderEphemeralReverse(validIr("safe.jpg"));

      expect(result.png.length).toBeGreaterThan(8);
      expect(readdirSync(root).sort()).toEqual(beforeNames);
      expect(createHash("sha256").update(readFileSync(sourcePath)).digest("hex")).toBe(beforeHash);
    } finally {
      if (previous === undefined) delete process.env.ROBBY_GALLERY_DIR;
      else process.env.ROBBY_GALLERY_DIR = previous;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a sheet whose source digest disagrees with the rendered source", async () => {
    const root = mkdtempSync(join(tmpdir(), "robby-live-source-"));
    const previous = process.env.ROBBY_GALLERY_DIR;
    process.env.ROBBY_GALLERY_DIR = root;
    try {
      copyFileSync(resolve(process.cwd(), "tests", "fixtures", "render-source.jpg"), join(root, "safe.jpg"));
      await expect(renderEphemeralReverse(validIr("safe.jpg"), {
        source_sha256: "f".repeat(64),
        evidence: { exif: null, iptc: null, xmp: null, gps: null, c2pa: null },
        included: [],
        withheld: [],
      })).rejects.toThrow("source_sha256");
    } finally {
      if (previous === undefined) delete process.env.ROBBY_GALLERY_DIR;
      else process.env.ROBBY_GALLERY_DIR = previous;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
