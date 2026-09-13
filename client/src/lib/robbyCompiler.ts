/**
 * ROBBY COMPILER BRIDGE — Contact-sheet archaeology.
 * This module is intentionally thin: the grammar, validation, diagnostics, and
 * IR are executed by the generated Rust/WebAssembly package, never TypeScript.
 */

import initRobbyCompiler, {
  compile_source_json,
  compiler_version,
  inspect_image_json,
  rust_toolchain,
} from "../wasm/robby_compiler";

export type RobbyReverseMode = "negative" | "observability_sheet" | "quantised_obverse" | "palette_grid";

export type RobbyIr = {
  version: "robby-ir-v1";
  canvas: { base: string; width: number | null; height: number | null };
  palette: { k: number };
  reverse: { mode: RobbyReverseMode };
  output: { obverse: string; reverse: string; manifest: string };
  meta: { script_sha256: string };
};

/** Public-safe intake manifest as produced by the shared Rust `inspect_image`. */
export type IntakeManifest = {
  schema_version: string;
  obverse: {
    original_name: string;
    mime_type: string;
    byte_size: number;
    byte_sha256: string;
    pixel_sha256: string;
    width: number;
    height: number;
    orientation: number | null;
    colour_profile: string | null;
  };
  evidence: {
    exif: { classification: string; value: unknown | null; visibility: string; state: string };
    iptc: { classification: string; value: unknown | null; visibility: string; state: string };
    xmp: { classification: string; value: unknown | null; visibility: string; state: string };
    gps: { classification: string; value: unknown | null; visibility: string; state: string };
    c2pa: { classification: string; value: unknown | null; visibility: string; state: string };
  };
};

let initialize: Promise<void> | null = null;

async function ensureRustCompiler() {
  if (!initialize) {
    initialize = initRobbyCompiler()
      .then(() => undefined)
      .catch((error) => {
        initialize = null;
        throw error;
      });
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

/** Inspect raw source bytes with the same Rust intake used natively (public-safe). */
export async function inspectWithRust(originalName: string, bytes: Uint8Array): Promise<IntakeManifest> {
  await ensureRustCompiler();
  return JSON.parse(inspect_image_json(originalName, bytes)) as IntakeManifest;
}

export async function rustCompilerVersion() {
  await ensureRustCompiler();
  return compiler_version();
}

/** Returns the rustc toolchain captured while the loaded WASM compiler was built. */
export async function rustToolchainVersion() {
  await ensureRustCompiler();
  return rust_toolchain();
}
