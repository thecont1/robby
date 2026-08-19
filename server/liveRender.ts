import express, { type Express } from "express";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { readLocalGallerySource } from "./gallerySource";
import {
  LiveRenderValidationError,
  normalizeLiveRenderableIr,
  type LiveRenderableIr,
} from "./liveRenderer";

export type RenderManifest = {
  version: string;
  source_obverse_sha256: string;
  script_settings_sha256: string;
  derived_seed: string;
  output_sha256: string;
  render_module: string;
  colour_swatches: string[];
  cached_intermediate: null;
};

export type EphemeralReverse = {
  png: Buffer;
  manifest: RenderManifest;
};

let renderQueue: Promise<unknown> = Promise.resolve();

function serialized<T>(work: () => Promise<T>) {
  const next = renderQueue.then(work, work);
  renderQueue = next.catch(() => undefined);
  return next;
}

function rustBinary() {
  return process.env.ROBBY_BINARY ?? resolve(process.cwd(), "target", "release", "robby");
}

async function runRustRenderer(sourcePath: string, ir: LiveRenderableIr): Promise<EphemeralReverse> {
  const settings = JSON.stringify({
    mode: ir.reverse.mode,
    k: ir.palette.k,
    width: ir.canvas.width,
    height: ir.canvas.height,
  });
  return new Promise((resolvePromise, reject) => {
    const child = spawn(rustBinary(), ["render", sourcePath, "--settings", settings], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", chunk => chunks.push(Buffer.from(chunk)));
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Rust renderer exited with ${code}`));
        return;
      }
      const manifestLine = stderr.split("\n").find(line => line.startsWith("ROBBY_MANIFEST:"));
      if (!manifestLine) {
        reject(new Error("Rust renderer omitted its manifest."));
        return;
      }
      try {
        const manifest = JSON.parse(manifestLine.slice("ROBBY_MANIFEST:".length)) as RenderManifest;
        resolvePromise({ png: Buffer.concat(chunks), manifest });
      } catch (error) {
        reject(new Error(`Rust renderer returned an invalid manifest: ${String(error)}`));
      }
    });
  });
}

/** One request invokes one Rust render and keeps its PNG only in process memory. */
export async function renderEphemeralReverse(irInput: unknown): Promise<EphemeralReverse> {
  const ir = normalizeLiveRenderableIr(irInput);
  let source;
  try {
    source = await readLocalGallerySource(ir.canvas.base);
  } catch (error) {
    throw new LiveRenderValidationError(
      error instanceof Error ? error.message : "The watched gallery source is unavailable.",
    );
  }
  return runRustRenderer(source.path, ir);
}

export function registerLiveRenderRoutes(app: Express) {
  app.post("/api/reverse", express.json({ limit: "256kb" }), createEphemeralReverseHandler());
}

type ReverseResponse = {
  status: (code: number) => ReverseResponse;
  setHeader: (name: string, value: string) => void;
  type: (value: string) => ReverseResponse;
  send: (body: Buffer) => unknown;
  json: (body: unknown) => unknown;
};
type RenderFunction = (ir: unknown) => Promise<EphemeralReverse>;

export function createEphemeralReverseHandler(render: RenderFunction = renderEphemeralReverse) {
  return async (req: { body?: { ir?: unknown } }, res: ReverseResponse) => {
    try {
      const result = await serialized(() => render(req.body?.ir));
      const manifest = result.manifest;
      res.status(200);
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("X-Robby-Source-SHA256", manifest.source_obverse_sha256);
      res.setHeader("X-Robby-Output-SHA256", manifest.output_sha256);
      res.setHeader("X-Robby-Derived-Seed", manifest.derived_seed);
      res.setHeader("X-Robby-Settings-SHA256", manifest.script_settings_sha256);
      res.setHeader("X-Robby-Render-Module", manifest.render_module);
      res.setHeader("X-Robby-Manifest", JSON.stringify(manifest));
      res.type("image/png").send(result.png);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Live reverse rendering failed";
      const status = error instanceof LiveRenderValidationError ? 400 : 500;
      res.status(status).json({ error: message });
    }
  };
}
