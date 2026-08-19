import crypto from "node:crypto";

type UnknownRecord = Record<string, unknown>;

export type LiveRenderableIr = {
  version: "robby-ir-v1";
  canvas: { base: string; width: number | null; height: number | null };
  palette: { k: number };
  reverse: { mode: "negative" };
  output: { obverse: string; reverse: string; manifest: string };
  meta: { script_sha256: string };
};

export class LiveRenderValidationError extends Error {}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: UnknownRecord, allowed: readonly string[], label: string) {
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length) throw new LiveRenderValidationError(`Unknown IR field ${label}.${unknown[0]}.`);
}

function dimension(value: unknown, label: string) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 4096) {
    throw new LiveRenderValidationError(`${label} must be an integer between 1 and 4096.`);
  }
  return Number(value);
}

export function normalizeLiveRenderableIr(value: unknown): LiveRenderableIr {
  if (!isRecord(value) || value.version !== "robby-ir-v1") {
    throw new LiveRenderValidationError("Expected a Rust-validated robby-ir-v1 document.");
  }
  exactKeys(value, ["version", "canvas", "palette", "reverse", "output", "meta"], "root");
  if (!isRecord(value.canvas)) throw new LiveRenderValidationError("IR canvas must be an object.");
  exactKeys(value.canvas, ["base", "width", "height"], "canvas");
  if (typeof value.canvas.base !== "string" || value.canvas.base.length === 0) {
    throw new LiveRenderValidationError("The live renderer requires one gallery base source.");
  }
  const width = dimension(value.canvas.width, "Canvas width");
  const height = dimension(value.canvas.height, "Canvas height");

  if (!isRecord(value.palette) || !Number.isInteger(value.palette.k) || Number(value.palette.k) < 3 || Number(value.palette.k) > 16) {
    throw new LiveRenderValidationError("Palette k must be an integer between 3 and 16.");
  }
  exactKeys(value.palette, ["k"], "palette");
  if (!isRecord(value.reverse) || value.reverse.mode !== "negative") {
    throw new LiveRenderValidationError("Live reverse mode must be negative.");
  }
  exactKeys(value.reverse, ["mode"], "reverse");
  if (!isRecord(value.output)) throw new LiveRenderValidationError("IR output must be an object.");
  exactKeys(value.output, ["obverse", "reverse", "manifest"], "output");
  for (const key of ["obverse", "reverse", "manifest"] as const) {
    if (typeof value.output[key] !== "string") throw new LiveRenderValidationError(`IR output.${key} must be a string.`);
  }
  if (!isRecord(value.meta) || typeof value.meta.script_sha256 !== "string") {
    throw new LiveRenderValidationError("IR meta.script_sha256 must be present.");
  }
  exactKeys(value.meta, ["script_sha256"], "meta");

  return {
    version: "robby-ir-v1",
    canvas: { base: value.canvas.base, width, height },
    palette: { k: Number(value.palette.k) },
    reverse: { mode: "negative" },
    output: {
      obverse: value.output.obverse as string,
      reverse: value.output.reverse as string,
      manifest: value.output.manifest as string,
    },
    meta: { script_sha256: value.meta.script_sha256 },
  };
}

export function renderFingerprint(ir: LiveRenderableIr) {
  return crypto.createHash("sha256").update(JSON.stringify({
    source: ir.canvas.base,
    mode: ir.reverse.mode,
    k: ir.palette.k,
    width: ir.canvas.width,
    height: ir.canvas.height,
  })).digest("hex");
}