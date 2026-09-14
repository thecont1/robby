import express, { type Express } from "express";
import { spawn } from "node:child_process";
import { basename, resolve } from "node:path";
import { readLocalGallerySource } from "./gallerySource";
import {
  LiveRenderValidationError,
  normalizeLiveRenderableIr,
  type LiveRenderableIr,
} from "./liveRenderer";

const SHEET_ROOT_KEYS = [
  "run_id",
  "binding_short_id",
  "source_sha256",
  "pixel_sha256",
  "recipe_sha256",
  "palette_k",
  "reverse_mode",
  "ir_schema",
  "policy_name",
  "evidence",
  "included",
  "withheld",
] as const;

const SHEET_EVIDENCE_KEYS = ["exif", "iptc", "xmp", "gps", "c2pa"] as const;
const EVIDENCE_TOKEN = "(OBSERVED|UNAVAILABLE|REDACTED|PRESENT|ABSENT|VALID|INVALID|NOT INSPECTED|NOT REPORTED|UNTRUSTED SIGNER|TRUSTED SIGNER|SIGNER NOT ASSESSED)";
const ALLOWED_EVIDENCE_STATES = new RegExp(`^${EVIDENCE_TOKEN}(?: · ${EVIDENCE_TOKEN})*$`);
// Finite public-safe disclosure vocabulary: DEFAULT_INCLUDED labels plus the
// omitted labels produced by the disclosure audit. Anything else — filenames,
// emails, coordinates — is rejected before it can be printed on the sheet.
const ALLOWED_DISCLOSURE_LABELS = new Set([
  "Palette",
  "binding mark",
  "recipe parameters",
  "evidence states",
  "source pixels",
  "quantised obverse",
  "filename",
  "capture time",
  "full hashes",
  "raw metadata",
  "raw GPS",
]);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new LiveRenderValidationError(`Sheet ${label} must be a string.`);
  if (value.length > 128) throw new LiveRenderValidationError(`Sheet ${label} is too long.`);
  if (/[-+]?\d+(?:\.\d+)?\s*[,/]\s*[-+]?\d+(?:\.\d+)?/.test(value)) {
    throw new LiveRenderValidationError("Sheet facts must not include raw GPS.");
  }
  if (/\.(jpe?g|png|tiff?|webp)$/i.test(value) || /[/\\]/.test(value)) {
    throw new LiveRenderValidationError("Sheet facts must not include filenames or paths.");
  }
  return value;
}

function optionalHex(value: unknown, label: string): string | null {
  const text = optionalString(value, label);
  if (text === null) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(text)) {
    throw new LiveRenderValidationError(`Sheet ${label} must be a 64-character hex digest.`);
  }
  return text;
}

function stringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new LiveRenderValidationError(`Sheet ${label} must be an array of strings.`);
  return value.map((entry, index) => {
    if (typeof entry !== "string" || entry.length === 0 || entry.length > 64) {
      throw new LiveRenderValidationError(`Sheet ${label}[${index}] must be a short string.`);
    }
    if (!ALLOWED_DISCLOSURE_LABELS.has(entry)) {
      throw new LiveRenderValidationError(`Sheet ${label}[${index}] is not a public-safe disclosure label.`);
    }
    return entry;
  });
}

export type LiveSheetFacts = {
  run_id: string | null;
  binding_short_id: string | null;
  source_sha256: string | null;
  pixel_sha256: string | null;
  recipe_sha256: string | null;
  palette_k: number | null;
  reverse_mode: string | null;
  ir_schema: string | null;
  policy_name: string | null;
  evidence: {
    exif: string | null;
    iptc: string | null;
    xmp: string | null;
    gps: string | null;
    c2pa: string | null;
  };
  included: string[];
  withheld: string[];
};

/** Public-safe sheet facts ride beside the IR; they never enter robby-ir-v1. */
export function normalizeLiveSheetFacts(value: unknown): LiveSheetFacts | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new LiveRenderValidationError("Sheet facts must be an object.");
  const unknown = Object.keys(value).filter(key => !SHEET_ROOT_KEYS.includes(key as typeof SHEET_ROOT_KEYS[number]));
  if (unknown.length) throw new LiveRenderValidationError(`Unknown sheet field ${unknown[0]}.`);
  const evidenceValue = value.evidence;
  if (!isRecord(evidenceValue)) throw new LiveRenderValidationError("Sheet evidence must be an object.");
  const unknownEvidence = Object.keys(evidenceValue).filter(key => !SHEET_EVIDENCE_KEYS.includes(key as typeof SHEET_EVIDENCE_KEYS[number]));
  if (unknownEvidence.length) throw new LiveRenderValidationError(`Unknown sheet evidence field ${unknownEvidence[0]}.`);

  const evidence = {
    exif: optionalString(evidenceValue.exif, "evidence.exif"),
    iptc: optionalString(evidenceValue.iptc, "evidence.iptc"),
    xmp: optionalString(evidenceValue.xmp, "evidence.xmp"),
    gps: optionalString(evidenceValue.gps, "evidence.gps"),
    c2pa: optionalString(evidenceValue.c2pa, "evidence.c2pa"),
  };
  for (const [key, state] of Object.entries(evidence)) {
    if (state && !ALLOWED_EVIDENCE_STATES.test(state)) {
      throw new LiveRenderValidationError(`Sheet evidence.${key} is not a public-safe state.`);
    }
  }
  const paletteK = value.palette_k === undefined || value.palette_k === null
    ? null
    : Number(value.palette_k);
  if (paletteK !== null && (!Number.isInteger(paletteK) || paletteK < 3 || paletteK > 64)) {
    throw new LiveRenderValidationError("Sheet palette_k must be an integer between 3 and 64.");
  }

  return {
    run_id: optionalString(value.run_id, "run_id"),
    binding_short_id: optionalString(value.binding_short_id, "binding_short_id"),
    source_sha256: optionalHex(value.source_sha256, "source_sha256"),
    pixel_sha256: optionalHex(value.pixel_sha256, "pixel_sha256"),
    recipe_sha256: optionalHex(value.recipe_sha256, "recipe_sha256"),
    palette_k: paletteK,
    reverse_mode: optionalString(value.reverse_mode, "reverse_mode"),
    ir_schema: optionalString(value.ir_schema, "ir_schema"),
    policy_name: optionalString(value.policy_name, "policy_name"),
    evidence,
    included: stringList(value.included ?? [], "included"),
    withheld: stringList(value.withheld ?? [], "withheld"),
  };
}

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

function serialized<T>(work: () => Promise<T>, signal?: AbortSignal) {
  const run = () => {
    if (signal?.aborted) {
      const error = new Error("Live reverse rendering was cancelled.");
      error.name = "AbortError";
      throw error;
    }
    return work();
  };
  const next = renderQueue.then(run, run);
  renderQueue = next.catch(() => undefined);
  return next;
}

function rustBinary() {
  return process.env.ROBBY_BINARY ?? resolve(process.cwd(), "target", "release", "robby");
}

export async function runRustRenderer(
  sourcePath: string,
  ir: LiveRenderableIr,
  sheet?: LiveSheetFacts,
  signal?: AbortSignal,
): Promise<EphemeralReverse> {
  if (signal?.aborted) {
    const error = new Error("Live reverse rendering was cancelled.");
    error.name = "AbortError";
    throw error;
  }
  const settings = JSON.stringify({
    mode: ir.reverse.mode,
    k: ir.palette.k,
    width: ir.canvas.width,
    height: ir.canvas.height,
    ...(sheet ? { sheet } : {}),
  });
  return new Promise((resolvePromise, reject) => {
    const child = spawn(rustBinary(), ["render", sourcePath, "--settings", settings], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let stderr = "";
    let settled = false;
    const abort = () => {
      child.kill("SIGTERM");
    };
    if (signal) {
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      fn();
    };
    child.stdout.on("data", chunk => chunks.push(Buffer.from(chunk)));
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.on("error", error => finish(() => reject(error)));
    child.on("close", code => {
      finish(() => {
        if (signal?.aborted) {
          const error = new Error("Live reverse rendering was cancelled.");
          error.name = "AbortError";
          reject(error);
          return;
        }
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
  });
}

/**
 * Reject a sheet that contradicts the IR it rides beside.
 *
 * The sheet is observability copy printed onto the render; the IR is what the
 * renderer actually executes. If a caller declares `reverse_mode` or
 * `palette_k` that disagree with the IR, the resulting plate would document a
 * render that never happened. Absent fields stay absent — only present values
 * are checked.
 */
function assertSheetMatchesIr(ir: LiveRenderableIr, sheet: LiveSheetFacts | undefined) {
  if (!sheet) return;
  if (sheet.reverse_mode !== null && sheet.reverse_mode !== ir.reverse.mode) {
    throw new LiveRenderValidationError("Sheet reverse_mode does not match the compiled IR reverse mode.");
  }
  if (sheet.palette_k !== null && sheet.palette_k !== ir.palette.k) {
    throw new LiveRenderValidationError("Sheet palette_k does not match the compiled IR palette k.");
  }
  if (sheet.ir_schema !== null && sheet.ir_schema !== ir.version) {
    throw new LiveRenderValidationError("Sheet ir_schema does not match the compiled IR version.");
  }
}

function assertSheetMatchesSourceDigest(sheet: LiveSheetFacts | undefined, sourceDigest: string) {
  if (!sheet?.source_sha256) return;
  if (sheet.source_sha256.toLowerCase() !== sourceDigest.toLowerCase()) {
    throw new LiveRenderValidationError("Sheet source_sha256 does not match the rendered source digest.");
  }
}

/** One request invokes one Rust render and keeps its PNG only in process memory. */
export async function renderEphemeralReverse(
  irInput: unknown,
  sheetInput?: unknown,
  signal?: AbortSignal,
): Promise<EphemeralReverse> {
  const ir = normalizeLiveRenderableIr(irInput);
  const sheet = normalizeLiveSheetFacts(sheetInput);
  assertSheetMatchesIr(ir, sheet);
  let source;
  try {
    source = await readLocalGallerySource(ir.canvas.base);
  } catch (error) {
    throw new LiveRenderValidationError(
      error instanceof Error ? error.message : "The watched gallery source is unavailable.",
    );
  }
  const result = await runRustRenderer(source.path, ir, sheet, signal);
  assertSheetMatchesSourceDigest(sheet, result.manifest.source_obverse_sha256);
  return result;
}

/**
 * Compute just the k-swatch default palette for a gallery specimen, without
 * a caller-supplied recipe. Used to precompute the permanent swatch grid the
 * Teppanyaki Counter shows before any compile — the PNG the native renderer
 * always produces alongside it is discarded, only `colour_swatches` matters.
 * `ir.canvas.base` is not read by `runRustRenderer` (only `sourcePath` is),
 * so a minimal synthetic IR is safe here.
 */
export async function computeDefaultPaletteSwatches(sourcePath: string, k = 8): Promise<string[]> {
  const ir: LiveRenderableIr = {
    version: "robby-ir-v1",
    canvas: { base: basename(sourcePath), width: null, height: null },
    palette: { k },
    reverse: { mode: "observability_sheet" },
    output: { obverse: "front.png", reverse: "transient", manifest: "transient" },
    meta: { script_sha256: "0".repeat(64) },
  };
  const result = await runRustRenderer(sourcePath, ir);
  return result.manifest.colour_swatches;
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
type RenderFunction = (ir: unknown, sheet?: unknown, signal?: AbortSignal) => Promise<EphemeralReverse>;

function abortSignalFromRequest(req: { aborted?: boolean; on?: (event: string, listener: () => void) => void }) {
  const controller = new AbortController();
  if (req.aborted) controller.abort();
  req.on?.("aborted", () => controller.abort());
  return controller.signal;
}

export function createEphemeralReverseHandler(render: RenderFunction = renderEphemeralReverse) {
  return async (req: { body?: { ir?: unknown; sheet?: unknown }; aborted?: boolean; on?: (event: string, listener: () => void) => void }, res: ReverseResponse) => {
    try {
      const sheet = normalizeLiveSheetFacts(req.body?.sheet);
      const signal = abortSignalFromRequest(req);
      const result = await serialized(() => render(req.body?.ir, sheet, signal), signal);
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
