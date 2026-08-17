/**
 * ROBBY COMPILER BRIDGE — Contact-sheet archaeology.
 * This module is intentionally thin: the grammar, validation, diagnostics, and
 * IR are executed by the generated Rust/WebAssembly package, never TypeScript.
 */

import initRobbyCompiler, {
  compile_source_json,
  compiler_version,
} from "../wasm/robby_compiler";

export type RobbyIr = {
  version: "robby-ir-v1";
  canvas: { base: string; width: number | null; height: number | null };
  cutouts: Array<{ id: string; source: string; mask: string }>;
  layers: Array<{ cutout: string; x: number; y: number; scale: number; rotation: number; opacity: number; blend: string }>;
  palette: { k: number } | null;
  reverse: Array<{ mode: "provenance-map" | "palette-grid"; k: number | null }>;
  output: { obverse: string; reverse: string; manifest: string };
  meta: { script_sha256: string };
};

let initialize: Promise<void> | null = null;

async function ensureRustCompiler() {
  if (!initialize) {
    initialize = initRobbyCompiler().then(() => undefined);
  }
  return initialize;
}

export async function compileWithRust(source: string): Promise<RobbyIr> {
  await ensureRustCompiler();
  const ir = JSON.parse(compile_source_json(source)) as RobbyIr;
  if (ir.version !== "robby-ir-v1") {
    throw new Error("Rust compiler returned an unexpected IR version.");
  }
  return ir;
}

export async function rustCompilerVersion() {
  await ensureRustCompiler();
  return compiler_version();
}
