import crypto from "crypto";

type UnknownRecord = Record<string, unknown>;

export type LiveRenderableIr = UnknownRecord & {
  version: "robby-ir-v1";
  canvas: { base: string; width?: number; height?: number };
  cutouts: unknown[];
  layers: unknown[];
  palette?: { k: number };
  reverse: Array<{ mode: "palette-grid" | "provenance-map"; k?: number | null }>;
  output: { obverse: string; reverse: string; manifest: string };
};

export class LiveRenderValidationError extends Error {}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validK(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 2 && Number(value) <= 16;
}

/**
 * The gallery exposes only authenticated base-image studies. Cutout assets are
 * deliberately rejected until they have their own immutable asset registry.
 */
export function normalizeLiveRenderableIr(value: unknown): LiveRenderableIr {
  if (!isRecord(value) || value.version !== "robby-ir-v1") throw new LiveRenderValidationError("Expected a Rust-validated robby-ir-v1 document.");
  if (!isRecord(value.canvas) || typeof value.canvas.base !== "string") throw new LiveRenderValidationError("The live executor requires one known base source.");
  if (!Array.isArray(value.cutouts) || !Array.isArray(value.layers) || value.cutouts.length || value.layers.length) {
    throw new LiveRenderValidationError("Live web rendering currently supports the gallery’s base-only programs; authenticated cutout assets are not yet registered.");
  }
  const width = value.canvas.width;
  const height = value.canvas.height;
  if ((width !== undefined && (!Number.isInteger(width) || Number(width) < 1 || Number(width) > 4096)) || (height !== undefined && (!Number.isInteger(height) || Number(height) < 1 || Number(height) > 4096)) || (Number(width ?? 1) * Number(height ?? 1) > 12_000_000)) {
    throw new LiveRenderValidationError("Live canvas dimensions must be whole numbers within the 12-megapixel execution limit.");
  }
  if (value.palette !== undefined && (!isRecord(value.palette) || !validK(value.palette.k))) throw new LiveRenderValidationError("Palette k must be an integer from 2 through 16.");
  if (!Array.isArray(value.reverse) || value.reverse.length !== 1 || !isRecord(value.reverse[0])) throw new LiveRenderValidationError("Live web rendering requires exactly one reverse mode.");
  const reverse = value.reverse[0];
  if (reverse.mode !== "palette-grid" && reverse.mode !== "provenance-map") throw new LiveRenderValidationError("Live reverse mode must be palette-grid or provenance-map.");
  if (reverse.k !== undefined && reverse.k !== null && !validK(reverse.k)) throw new LiveRenderValidationError("Reverse palette k must be an integer from 2 through 16.");

  return {
    ...value,
    version: "robby-ir-v1",
    canvas: { base: value.canvas.base, ...(width ? { width: Number(width) } : {}), ...(height ? { height: Number(height) } : {}) },
    cutouts: [],
    layers: [],
    palette: value.palette ? { k: Number(value.palette.k) } : undefined,
    reverse: [{ mode: reverse.mode, ...(reverse.k ? { k: Number(reverse.k) } : {}) }],
    // Client-authored names never reach the file system.
    output: { obverse: "obverse.png", reverse: "inverse.png", manifest: "manifest.json" },
  };
}

export function renderFingerprint(ir: LiveRenderableIr) {
  return crypto.createHash("sha256").update(JSON.stringify({ canvas: ir.canvas, palette: ir.palette, reverse: ir.reverse })).digest("hex");
}
