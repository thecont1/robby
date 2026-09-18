/**
 * ROBBY COMPILER BRIDGE — Contact-sheet archaeology.
 * This module is intentionally thin: the grammar, validation, diagnostics, and
 * IR are executed by the generated Rust/WebAssembly package, never TypeScript.
 */

import initRobbyCompiler, {
  binding_request_v1_json,
  build_binding_json,
  analyze_ingredients_json,
  compile_source_json,
  compiler_version,
  inspect_image_json,
  palette_preview_json,
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

export type IngredientAnalysis = {
  schema_version: "robby-ingredients-v1";
  source: {
    byte_sha256: string;
    pixel_sha256: string;
    byte_size: number;
    width: number;
    height: number;
    aspect_ratio: number;
    orientation: number | null;
    colour_profile: string | null;
  };
  evidence: {
    exif: string;
    iptc: string;
    xmp: string;
    gps: string;
    c2pa: string;
  };
  palette: {
    requested_k: number;
    method: string;
    ordering: string;
    entries: Array<{ hex: string; rgb: [number, number, number]; pixels: number; share_percent: number; rank: number }>;
    index_map_sha256: string;
  };
  structure: {
    grid_size: number;
    luminance_bands: number[];
    spatial_cells: Array<{ dominant_palette_rank: number; palette_mix: number[]; mean_luminance: number; texture: number }>;
    edge_field: number[];
    texture_field: number[];
  };
  identity: { perceptual_hash: string };
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

/** Run bounded visual-ingredient analysis without rendering or persisting an image. */
export async function analyzeIngredientsWithRust(bytes: Uint8Array, paletteK: number): Promise<IngredientAnalysis> {
  await ensureRustCompiler();
  return JSON.parse(analyze_ingredients_json(bytes, paletteK)) as IngredientAnalysis;
}

/** The authoritative Rust-produced binding record for a v1 gallery compile. */
export type RustBindingRecord = {
  schema_version: string;
  binding_sha256: string;
  short_id: string;
  recipe_ir_schema: string;
  source_byte_sha256: string;
  canonical_pixel_sha256: string;
  authored_recipe_sha256: string;
  canonical_recipe_sha256: string;
  disclosure_policy_sha256: string;
  selected_evidence_sha256: string;
  compiler_version: string;
  renderer_version: string;
  statement: string;
};

/** Structured selected evidence carried into the binding (never UI labels). */
export type SelectedEvidenceV1 = {
  schema: "robby-evidence-selection-v1";
  c2pa: {
    presence: string;
    validation: string;
    signerTrust: string;
    availability: string;
  };
};

/**
 * Build the canonical binding for the active v1 language in Rust.
 * The recipe is re-compiled inside Rust/WASM so canonical identity is
 * never derived from UI formatting.
 */
export async function buildCanonicalBindingWithRust(
  intakeManifestJson: string,
  recipeSource: string,
  evidence: SelectedEvidenceV1,
  compilerVersion: string,
  rendererVersion: string,
): Promise<RustBindingRecord> {
  await ensureRustCompiler();
  const requestJson = binding_request_v1_json(
    intakeManifestJson,
    recipeSource,
    JSON.stringify(evidence),
    compilerVersion,
    rendererVersion,
  );
  return JSON.parse(build_binding_json(requestJson)) as RustBindingRecord;
}

/**
 * Rust median-cut palette hexes for a source at a given k — the same list a
 * compile reports as `colour_swatches`, with no PNG rendered. Powers the
 * counter's live swatch preview when the k slider edits the recipe.
 */
export async function palettePreviewWithRust(bytes: Uint8Array, k: number): Promise<string[]> {
  await ensureRustCompiler();
  return JSON.parse(palette_preview_json(bytes, k)) as string[];
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
