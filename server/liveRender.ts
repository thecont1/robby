import crypto from "crypto";
import express, { type Express } from "express";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { spawn } from "child_process";
import { getLiveRenderSource } from "./liveRenderCatalog";
import { LiveRenderValidationError, normalizeLiveRenderableIr, renderFingerprint } from "./liveRenderer";
import { storageGetSignedUrl, storagePut } from "./storage";

type ExecutorManifest = {
  reverse: Array<{ mode: string; path: string; sha256: string }>;
  outputs: { obverse: { path: string; sha256: string }; manifest: { path: string; sha256: string } };
  palette: Array<{ k: number; colors: string[] }>;
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

async function renderLiveIr(irInput: unknown) {
  const ir = normalizeLiveRenderableIr(irInput);
  const source = getLiveRenderSource(ir.canvas.base);
  if (!source) throw new LiveRenderValidationError(`The source ${ir.canvas.base} is not registered as an immutable live-render original.`);

  const signedSourceUrl = await storageGetSignedUrl(source.storageKey);
  const sourceResponse = await fetch(signedSourceUrl);
  if (!sourceResponse.ok) throw new Error("Could not retrieve the immutable original for rendering.");
  const originalBytes = Buffer.from(await sourceResponse.arrayBuffer());
  const actualHash = crypto.createHash("sha256").update(originalBytes).digest("hex");
  if (actualHash !== source.sha256) throw new Error("Immutable source checksum mismatch; rendering stopped before source use.");

  const workDir = await mkdtemp(path.join(tmpdir(), "robby-live-"));
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

    const renderId = `${renderFingerprint(ir).slice(0, 16)}-${Date.now().toString(36)}`;
    const prefix = `live-renders/${source.sha256}/${renderId}`;
    const [obverse, inverse, manifestArtifact] = await Promise.all([
      storagePut(`${prefix}/obverse.png`, await readFile(path.join(outputDir, manifest.outputs.obverse.path)), "image/png"),
      storagePut(`${prefix}/inverse.png`, await readFile(path.join(outputDir, reverse.path)), "image/png"),
      storagePut(`${prefix}/manifest.json`, await readFile(path.join(outputDir, "manifest.json")), "application/json"),
    ]);
    return { obverseUrl: obverse.url, inverseUrl: inverse.url, manifestUrl: manifestArtifact.url, sourceSha256: actualHash, outputSha256: reverse.sha256, palette: manifest.palette, reverseMode: reverse.mode, renderId };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export function registerLiveRenderRoutes(app: Express) {
  app.post("/api/live-render", express.json({ limit: "256kb" }), createLiveRenderHandler());
}

type RenderFunction = (ir: unknown) => Promise<unknown>;
type LiveRenderResponse = { status: (code: number) => LiveRenderResponse; json: (body: unknown) => unknown };

export function createLiveRenderHandler(render: RenderFunction = renderLiveIr) {
  return async (req: { body?: { ir?: unknown } }, res: LiveRenderResponse) => {
    try {
      const result = await serialized(() => render(req.body?.ir));
      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Live rendering failed";
      const status = error instanceof LiveRenderValidationError ? 400 : 500;
      res.status(status).json({ error: message });
    }
  };
}

export { renderLiveIr };
