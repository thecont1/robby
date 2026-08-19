/**
 * Gallery folder watcher.
 *
 * Scans a local `gallery/` directory for JPEG files and serves them as
 * gallery records. A `.robby` script file is generated next to each image
 * on first sight; if it already exists (e.g. the user edited parameters),
 * the existing script is read and used instead.
 *
 * When files are added, removed, or `.robby` scripts are edited, connected
 * clients are notified via Server-Sent Events.
 */

import type { Express } from "express";
import { EventEmitter } from "node:events";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { watch, type FSWatcher } from "node:fs";
import { buildDefaultGalleryScript, parseGalleryScriptSettings, readJpegDimensions } from "./galleryMetadata";
import { galleryDirectory, validateGalleryFilename } from "./gallerySource";

export function configuredGalleryDirectory() {
  return galleryDirectory();
}

export type DynamicGalleryItem = {
  id: string;
  serial: string;
  title: string;
  subtitle: string;
  date: string;
  source: string;
  dimensions: string;
  ratio: "four-three" | "three-two";
  obverse: string;
  reverse: string;
  reverseMode: "negative";
  reverseKind: string;
  reverseDescription: string;
  scriptHash: string;
  outputHash: string;
  palette: string[];
  script: string;
  trace: { stage: string; label: string; code: string; detail: string }[];
  credentialSignature: { status: "absent"; sourceSha256: string; verificationMethod: string; note: string };
  colourSignature: { pixelSha256: string; paletteSha256: string; algorithm: string };
};

function measureImage(filePath: string): { width: number; height: number } {
  try {
    return readJpegDimensions(readFileSync(filePath));
  } catch {
    return { width: 0, height: 0 };
  }
}

function computeRatio(width: number, height: number): "four-three" | "three-two" {
  const ratio = width / height;
  return Math.abs(ratio - 4 / 3) < Math.abs(ratio - 3 / 2) ? "four-three" : "three-two";
}


/**
 * Returns the script for a given image. If a `.robby` file exists next
 * to the image, it is read and used (preserving user edits). Otherwise,
 * a default script is generated and written to disk for future editing.
 */
function getOrGenerateScript(id: string, source: string, galleryDir: string): string {
  const robbyPath = join(galleryDir, `${id}.robby`);
  if (existsSync(robbyPath)) {
    try {
      return readFileSync(robbyPath, "utf-8");
    } catch {
      // Fall through to default
    }
  }
  const script = buildDefaultGalleryScript(source);
  try {
    writeFileSync(robbyPath, script, "utf-8");
  } catch {
    // Non-fatal — the script still works in memory
  }
  return script;
}

/**
 * Parse a few fields from a .robby script so the gallery record can
 * reflect user edits (e.g. k=20 instead of k=8).
 */
function buildTrace(script: string, source: string, dimensions: string): { stage: string; label: string; code: string; detail: string }[] {
  const { paletteK, reverseMode } = parseGalleryScriptSettings(script);
  const trace: { stage: string; label: string; code: string; detail: string }[] = [
    { stage: "01", label: "Base canvas", code: `base(${JSON.stringify(source)})`, detail: `${dimensions} · source checksum recorded` },
  ];
  const paletteCode = script.match(/palette\([^)]+\)/)?.[0] ?? `palette(k: ${paletteK})`;
  trace.push({ stage: "02", label: "Calculate palette", code: paletteCode, detail: `${paletteK} dominant clusters sampled from obverse` });
  const reverseCode = script.match(/reverse\([^)]+\)/)?.[0] ?? `reverse(mode: "${reverseMode}")`;
  trace.push({ stage: "03", label: "Render inverse", code: reverseCode, detail: "seed-driven negative module · generated only on flip" });
  const outputCode = script.match(/output\([^)]+\)/)?.[0] ?? "output(…)";
  trace.push({ stage: "04", label: "Return manifest", code: outputCode, detail: "transient PNG + reproducibility record · no persisted reverse" });
  return trace;
}

export async function scanGallery(galleryDir = configuredGalleryDirectory()): Promise<DynamicGalleryItem[]> {
  const root = resolve(galleryDir);
  let files: string[] = [];
  try {
    const realRoot = realpathSync(root);
    files = readdirSync(root)
      .filter(f => /\.(jpg|jpeg)$/i.test(extname(f)))
      .filter(f => {
        try {
          const filePath = join(root, f);
          return !lstatSync(filePath).isSymbolicLink()
            && realpathSync(filePath).startsWith(`${realRoot}/`)
            && statSync(filePath).isFile();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }

  const candidates = await Promise.all(files.map(async (filename): Promise<DynamicGalleryItem | null> => {
    try {
    const filePath = join(root, filename);
    const id = basename(filename, extname(filename));
    const { width, height } = measureImage(filePath);
    const dimensions = width && height ? `${width} × ${height}` : "unknown";
    const ratio = width && height ? computeRatio(width, height) : "four-three";
    const date = filename.match(/^MS(\d{4})/)?.[1] ?? "unknown";
    const script = getOrGenerateScript(id, filename, root);
    const { paletteK, reverseMode } = parseGalleryScriptSettings(script);

    return {
      id,
      serial: "",
      title: filename,
      subtitle: "",
      date,
      source: filename,
      dimensions,
      ratio,
      obverse: `/gallery/${filename}`,
      reverse: "",
      reverseMode,
      reverseKind: "Seeded negative",
      reverseDescription: "",
      scriptHash: "",
      outputHash: "",
      palette: [],
      script,
      trace: buildTrace(script, filename, dimensions),
      credentialSignature: { status: "absent", sourceSha256: "", verificationMethod: "none", note: "C2PA not yet inspected" },
      colourSignature: { pixelSha256: "", paletteSha256: "", algorithm: `robby-render-v1 kmeans-${paletteK} · computed on flip` },
    };
    } catch {
      return null;
    }
  }));
  const items = candidates.filter((item): item is DynamicGalleryItem => item !== null);
  return items.map((item, index) => ({
    ...item,
    serial: `${String(index + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`,
  }));
}

class GalleryWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentItems: DynamicGalleryItem[] = [];

  constructor(private readonly galleryDir = configuredGalleryDirectory()) {
    super();
    this.refresh();
    this.startWatching();
  }

  private async refresh() {
    this.currentItems = await scanGallery(this.galleryDir);
    this.emit("update", this.currentItems);
  }

  private startWatching() {
    try {
      this.watcher = watch(this.galleryDir, { persistent: false }, () => {
        // Debounce — editors often trigger multiple events
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null;
          this.refresh();
        }, 300);
      });
    } catch {
      // Gallery dir doesn't exist yet — try again in 2 seconds
      setTimeout(() => this.startWatching(), 2000);
    }
  }

  getItems(): DynamicGalleryItem[] {
    return this.currentItems;
  }

  close() {
    this.watcher?.close();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}

const watcher = new GalleryWatcher();

export function registerGalleryRoutes(app: Express) {
  // Serve only gallery JPEGs; sidecars and unrelated files remain private.
  app.get("/gallery/*", (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing gallery file");
      return;
    }
    try {
      validateGalleryFilename(key);
    } catch {
      res.status(404).send("Not found");
      return;
    }
    const root = configuredGalleryDirectory();
    const filePath = resolve(join(root, key));
    if (!filePath.startsWith(root + "/") && filePath !== root) {
      res.status(404).send("Not found");
      return;
    }
    try {
      if (lstatSync(filePath).isSymbolicLink()) {
        res.status(404).send("Not found");
        return;
      }
      const realRoot = realpathSync(root);
      if (!realpathSync(filePath).startsWith(`${realRoot}/`)) {
        res.status(404).send("Not found");
        return;
      }
      const stat = statSync(filePath);
      if (!stat.isFile()) {
        res.status(404).send("Not found");
        return;
      }
    } catch {
      res.status(404).send("Not found");
      return;
    }
    res.sendFile(filePath);
  });

  // GET gallery data as JSON
  app.get("/api/gallery", (_req, res) => {
    res.json(watcher.getItems());
  });

  // SSE stream for live updates
  app.get("/api/gallery/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("retry: 3000\n\n");

    // Send current state immediately
    res.write(`data: ${JSON.stringify(watcher.getItems())}\n\n`);

    const onUpdate = (items: DynamicGalleryItem[]) => {
      res.write(`data: ${JSON.stringify(items)}\n\n`);
    };

    watcher.on("update", onUpdate);

    req.on("close", () => {
      watcher.off("update", onUpdate);
    });
  });
}
