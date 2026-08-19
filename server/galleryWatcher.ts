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
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { watch, type FSWatcher } from "node:fs";

const GALLERY_DIR = resolve(process.cwd(), "gallery");

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
  reverseMode: "palette-grid";
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
    const output = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath], {
      encoding: "utf-8",
      timeout: 5000,
    });
    const width = parseInt(output.match(/pixelWidth:\s*(\d+)/)?.[1] ?? "0", 10);
    const height = parseInt(output.match(/pixelHeight:\s*(\d+)/)?.[1] ?? "0", 10);
    return { width, height };
  } catch {
    return { width: 0, height: 0 };
  }
}

function computeRatio(width: number, height: number): "four-three" | "three-two" {
  const ratio = width / height;
  return Math.abs(ratio - 4 / 3) < Math.abs(ratio - 3 / 2) ? "four-three" : "three-two";
}

function defaultScript(id: string, source: string): string {
  return `base("${source}")
palette(k: 8)
reverse(mode: "palette-grid", k: 8)
output(obverse: "${id}-obverse.png", reverse: "${id}-inverse.png", manifest: "${id}-manifest.json")
`;
}

/**
 * Returns the script for a given image. If a `.robby` file exists next
 * to the image, it is read and used (preserving user edits). Otherwise,
 * a default script is generated and written to disk for future editing.
 */
function getOrGenerateScript(id: string, source: string): string {
  const robbyPath = join(GALLERY_DIR, `${id}.robby`);
  if (existsSync(robbyPath)) {
    try {
      return readFileSync(robbyPath, "utf-8");
    } catch {
      // Fall through to default
    }
  }
  const script = defaultScript(id, source);
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
function parseScriptMeta(script: string): {
  paletteK: number;
  reverseMode: string;
  reverseK: number | null;
} {
  const paletteK = parseInt(script.match(/palette\(k:\s*(\d+)\)/)?.[1] ?? "8", 10);
  const reverseModeMatch = script.match(/reverse\(mode:\s*"([^"]+)"/);
  const reverseMode = reverseModeMatch?.[1] ?? "palette-grid";
  const reverseK = script.match(/reverse\(mode:\s*"[^"]+",\s*k:\s*(\d+)\)/)
    ? parseInt(script.match(/reverse\(mode:\s*"[^"]+",\s*k:\s*(\d+)\)/)![1], 10)
    : null;
  return { paletteK, reverseMode, reverseK };
}

function buildTrace(script: string, source: string, dimensions: string): { stage: string; label: string; code: string; detail: string }[] {
  const { paletteK, reverseMode, reverseK } = parseScriptMeta(script);
  const trace: { stage: string; label: string; code: string; detail: string }[] = [
    { stage: "01", label: "Base canvas", code: `base("${source}")`, detail: `${dimensions} · source checksum recorded` },
  ];
  const paletteCode = script.match(/palette\([^)]+\)/)?.[0] ?? `palette(k: ${paletteK})`;
  trace.push({ stage: "02", label: "Calculate palette", code: paletteCode, detail: `${paletteK} dominant clusters sampled from obverse` });
  const reverseCode = script.match(/reverse\([^)]+\)/)?.[0] ?? `reverse(mode: "${reverseMode}")`;
  trace.push({ stage: "03", label: "Render inverse", code: reverseCode, detail: reverseK ? `palette grid · k=${reverseK}` : "palette plate derived from the rendered obverse" });
  const outputCode = script.match(/output\([^)]+\)/)?.[0] ?? "output(…)";
  trace.push({ stage: "04", label: "Write manifest", code: outputCode, detail: "static deployment · image render pending" });
  return trace;
}

function scanGallery(): DynamicGalleryItem[] {
  let files: string[] = [];
  try {
    files = readdirSync(GALLERY_DIR)
      .filter(f => /\.(jpg|jpeg)$/i.test(extname(f)))
      .filter(f => {
        try {
          return statSync(join(GALLERY_DIR, f)).isFile();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }

  return files.map((filename, index) => {
    const filePath = join(GALLERY_DIR, filename);
    const id = basename(filename, extname(filename));
    const { width, height } = measureImage(filePath);
    const dimensions = width && height ? `${width} × ${height}` : "unknown";
    const ratio = width && height ? computeRatio(width, height) : "four-three";
    const date = filename.match(/^MS(\d{4})/)?.[1] ?? "unknown";
    const script = getOrGenerateScript(id, filename);
    const { paletteK, reverseMode } = parseScriptMeta(script);

    return {
      id,
      serial: `${String(index + 1).padStart(2, "0")} / ${String(files.length).padStart(2, "0")}`,
      title: filename,
      subtitle: "",
      date,
      source: filename,
      dimensions,
      ratio,
      obverse: `/gallery/${filename}`,
      reverse: "",
      reverseMode: reverseMode as "palette-grid",
      reverseKind: "Palette plate",
      reverseDescription: "",
      scriptHash: "",
      outputHash: "",
      palette: [],
      script,
      trace: buildTrace(script, filename, dimensions),
      credentialSignature: { status: "absent", sourceSha256: "", verificationMethod: "none", note: "C2PA not yet inspected" },
      colourSignature: { pixelSha256: "", paletteSha256: "", algorithm: `kmeans-${paletteK}` },
    };
  });
}

class GalleryWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentItems: DynamicGalleryItem[] = [];

  constructor() {
    super();
    this.refresh();
    this.startWatching();
  }

  private refresh() {
    this.currentItems = scanGallery();
    this.emit("update", this.currentItems);
  }

  private startWatching() {
    try {
      this.watcher = watch(GALLERY_DIR, { persistent: false }, () => {
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
  // Serve gallery images and .robby scripts statically
  app.get("/gallery/*", (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing gallery file");
      return;
    }
    const filePath = join(GALLERY_DIR, key);
    try {
      const stat = statSync(filePath);
      if (!stat.isFile()) {
        res.status(404).send("Not found");
        return;
      }
    } catch {
      res.status(404).send("Not found");
      return;
    }
    res.sendFile(resolve(filePath));
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
