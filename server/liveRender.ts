import crypto from "crypto";
import express, { type Express } from "express";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { spawn } from "child_process";
import { getLiveRenderSource } from "./liveRenderCatalog";
import { LiveRenderValidationError, normalizeLiveRenderableIr, renderFingerprint } from "./liveRenderer";
import { storageGetSignedUrl } from "./storage";

type ExecutorManifest = {
  reverse: Array<{ mode: string; path: string; sha256: string }>;
  palette: Array<{ k: number; colors: string[] }>;
};

export type EphemeralReverse = {
  png: Buffer;
  sourceSha256: string;
  outputSha256: string;
  palette: Array<{ k: number; colors: string[] }>;
  reverseMode: string;
  renderFingerprint: string;
};

let renderQueue: Promise<unknown> = Promise.resolve();

function serialized<T>(work: () => Promise<T>) {
  const next = renderQueue.then(work, work);
  renderQueue = next.catch(() => undefined);
  return next;
}

async function runPythonExecutor(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("python3", args, { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(stderr.trim() || `Python executor exited with ${code}`)));
  });
}

/**
 * Executes one inverse request in a temporary workspace. The result is returned
 * as response bytes only; it is never uploaded, stored in the database, or given
 * a durable URL. The temporary workspace is removed before this promise settles.
 */
export async function renderEphemeralReverse(irInput: unknown): Promise<EphemeralReverse> {
  const ir = normalizeLiveRenderableIr(irInput);
  const source = getLiveRenderSource(ir.canvas.base);
  if (!source) throw new LiveRenderValidationError(`The source ${ir.canvas.base} is not registered as an immutable live-render original.`);

  const signedSourceUrl = await storageGetSignedUrl(source.storageKey);
  const sourceResponse = await fetch(signedSourceUrl);
  if (!sourceResponse.ok) throw new Error("Could not retrieve the immutable original for rendering.");
  const originalBytes = Buffer.from(await sourceResponse.arrayBuffer());
  const actualHash = crypto.createHash("sha256").update(originalBytes).digest("hex");
  if (actualHash !== source.sha256) throw new Error("Immutable source checksum mismatch; rendering stopped before source use.");

  const workDir = await mkdtemp(path.join(tmpdir(), "robby-reverse-"));
  try {
    const assetsDir = path.join(workDir, "assets");
    const outputDir = path.join(workDir, "output");
    const irPath = path.join(workDir, "ir.json");
    await mkdir(assetsDir, { recursive: true });
    await writeFile(path.join(assetsDir, ir.canvas.base), originalBytes);
    await writeFile(irPath, JSON.stringify(ir));
    await runPythonExecutor([path.join("executor", "run.py"), "--ir", irPath, "--assets-root", assetsDir, "--out-dir", outputDir]);

    const manifest = JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8")) as ExecutorManifest;
    const reverse = manifest.reverse[0];
    if (!reverse) throw new Error("Executor completed without a reverse image.");
    const png = await readFile(path.join(outputDir, reverse.path));
    const outputSha256 = crypto.createHash("sha256").update(png).digest("hex");
    if (outputSha256 !== reverse.sha256) throw new Error("Transient reverse checksum mismatch.");

    return {
      png,
      sourceSha256: actualHash,
      outputSha256,
      palette: manifest.palette,
      reverseMode: reverse.mode,
      renderFingerprint: renderFingerprint(ir),
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
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
      res.status(200);
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("X-Robby-Source-SHA256", result.sourceSha256);
      res.setHeader("X-Robby-Output-SHA256", result.outputSha256);
      res.setHeader("X-Robby-Reverse-Mode", result.reverseMode);
      res.setHeader("X-Robby-Render-Fingerprint", result.renderFingerprint);
      res.type("image/png").send(result.png);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Live reverse rendering failed";
      const status = error instanceof LiveRenderValidationError ? 400 : 500;
      res.status(status).json({ error: message });
    }
  };
}
