import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanGallery } from "./galleryWatcher";
import { validateGalleryFilename } from "./gallerySource";

const fixture = resolve(process.cwd(), "tests", "fixtures", "render-source.jpg");
const fakeBinary = resolve(process.cwd(), "server", "fixtures", "fakeRobbyBinary.mjs");

function tempGallery() {
  return mkdtempSync(join(tmpdir(), "robby-gallery-watcher-"));
}

const envKeysTouched = ["TROID_BINARY", "ROBBY_FAKE_CALLS_LOG", "ROBBY_GALLERY_MAX_ITEMS"] as const;
type TouchedEnvKey = (typeof envKeysTouched)[number];
const savedEnv: Partial<Record<TouchedEnvKey, string | undefined>> = {};

function withEnv(overrides: Partial<Record<TouchedEnvKey, string>>) {
  for (const key of envKeysTouched) {
    if (!(key in savedEnv)) savedEnv[key] = process.env[key];
  }
  for (const key of envKeysTouched) {
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
}

afterEach(() => {
  for (const key of envKeysTouched) {
    if (key in savedEnv) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
      delete savedEnv[key];
    }
  }
});

describe("gallery snapshot", () => {
  it("reads the configured root instead of the repository gallery", async () => {
    const root = tempGallery();
    try {
      copyFileSync(fixture, join(root, "configured.jpg"));
      const items = await scanGallery(root);
      expect(items.map(item => item.source)).toEqual(["configured.jpg"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns an empty snapshot for a missing or empty directory", async () => {
    const root = tempGallery();
    try {
      expect(await scanGallery(root)).toEqual([]);
      expect(await scanGallery(join(root, "missing"))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("isolates one invalid sidecar instead of suppressing valid specimens", async () => {
    const root = tempGallery();
    try {
      copyFileSync(fixture, join(root, "bad.jpg"));
      copyFileSync(fixture, join(root, "good.jpg"));
      writeFileSync(join(root, "bad.robby"), `base("bad.jpg")\npalette(k: 99)\nreverse(mode: "negative")\noutput(obverse: "bad.jpg", reverse: "transient", manifest: "transient")\n`);

      const items = await scanGallery(root);
      expect(items.map(item => item.source)).toEqual(["good.jpg"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not catalogue JPEG filenames the serving boundary rejects", async () => {
    const root = tempGallery();
    try {
      copyFileSync(fixture, join(root, `quote"name.jpg`));
      expect(await scanGallery(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // Bug reproduction: scanGallery admits any *.jpg name, but the /gallery/*
  // route and readLocalGallerySource enforce validateGalleryFilename, which
  // rejects names like `quote"name.jpg`. Catalogued specimens must be servable.
  it("only catalogues specimens the serving boundary will serve", async () => {
    const root = tempGallery();
    try {
      copyFileSync(fixture, join(root, `quote"name.jpg`));
      copyFileSync(fixture, join(root, "regular.jpg"));
      const items = await scanGallery(root);
      for (const item of items) {
        expect(() => validateGalleryFilename(item.source)).not.toThrow();
      }
      expect(items.map(item => item.source)).toEqual(["regular.jpg"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("never writes recipes, previews, or sidecars into the watched source folder", async () => {
    const root = tempGallery();
    try {
      const sourcePath = join(root, "configured.jpg");
      copyFileSync(fixture, sourcePath);
      const beforeHash = createHash("sha256").update(readFileSync(sourcePath)).digest("hex");
      const beforeNames = readdirSync(root).sort();

      const items = await scanGallery(root);

      expect(items.map(item => item.source)).toEqual(["configured.jpg"]);
      expect(items[0]?.script).toContain("configured.jpg");
      expect(readdirSync(root).sort()).toEqual(beforeNames);
      expect(readdirSync(root)).toEqual(["configured.jpg"]);
      expect(createHash("sha256").update(readFileSync(sourcePath)).digest("hex")).toBe(beforeHash);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reads an existing user-authored recipe without rewriting it", async () => {
    const root = tempGallery();
    try {
      copyFileSync(fixture, join(root, "authored.jpg"));
      const recipe = `base("authored.jpg")\npalette(k: 12)\nreverse(mode: "observability_sheet")\noutput(obverse: "authored.jpg", reverse: "transient", manifest: "transient")\n`;
      const recipePath = join(root, "authored.robby");
      writeFileSync(recipePath, recipe);
      const before = readFileSync(recipePath, "utf-8");

      const items = await scanGallery(root);

      expect(items[0]?.script).toBe(recipe);
      expect(readFileSync(recipePath, "utf-8")).toBe(before);
      expect(readdirSync(root).sort()).toEqual(["authored.jpg", "authored.robby"]);
      expect(items[0]?.trace.find(step => step.stage === "03")?.code).toBe('reverse(mode: "observability_sheet")');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("populates each item's default palette and only re-renders when the file changes", async () => {
    const root = tempGallery();
    const callsLog = join(root, "..", `robby-fake-calls-${Math.random().toString(36).slice(2)}.log`);
    try {
      copyFileSync(fixture, join(root, "one.jpg"));
      withEnv({ TROID_BINARY: fakeBinary, ROBBY_FAKE_CALLS_LOG: callsLog });

      const first = await scanGallery(root);
      expect(first).toHaveLength(1);
      expect(first[0]?.palette).toHaveLength(8);
      expect(first[0]?.palette.every(swatch => /^#[0-9a-f]{6}$/.test(swatch))).toBe(true);
      const callsAfterFirst = existsSync(callsLog) ? readFileSync(callsLog, "utf-8").trim().split("\n").filter(Boolean) : [];
      expect(callsAfterFirst).toHaveLength(1);

      // Same file, unchanged mtime: the palette cache should serve the
      // cached swatches without invoking the (fake) renderer again.
      const second = await scanGallery(root);
      expect(second[0]?.palette).toEqual(first[0]?.palette);
      const callsAfterSecond = readFileSync(callsLog, "utf-8").trim().split("\n").filter(Boolean);
      expect(callsAfterSecond).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(callsLog, { force: true });
    }
  });

  it("caps the catalogue at ROBBY_GALLERY_MAX_ITEMS, keeping the alphabetically first specimens", async () => {
    const root = tempGallery();
    try {
      copyFileSync(fixture, join(root, "a.jpg"));
      copyFileSync(fixture, join(root, "b.jpg"));
      copyFileSync(fixture, join(root, "c.jpg"));
      withEnv({ ROBBY_GALLERY_MAX_ITEMS: "2", TROID_BINARY: fakeBinary });

      const items = await scanGallery(root);

      expect(items.map(item => item.source)).toEqual(["a.jpg", "b.jpg"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
