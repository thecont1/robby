/* tslint:disable */
/* eslint-disable */
/**
* Compile Robby source in the browser using this exact Rust library.
* @param {string} source
* @returns {string}
*/
export function compile_source_json(source: string): string;
/**
* Compile the versioned object-block recipe language in the browser.
* @param {string} source
* @returns {string}
*/
export function compile_recipe_json(source: string): string;
/**
* Build the authoritative canonical `BindingRecord` from a JSON
* `CanonicalBindingRequest`. One algorithm, shared with the native CLI.
* @param {string} request_json
* @returns {string}
*/
export function build_binding_json(request_json: string): string;
/**
* Build the canonical v1 binding request in Rust from the public-safe
* intake manifest, authored recipe source, and structured evidence.
* @param {string} intake_json
* @param {string} recipe_source
* @param {string} evidence_json
* @param {string} compiler_version
* @param {string} renderer_version
* @returns {string}
*/
export function binding_request_v1_json(intake_json: string, recipe_source: string, evidence_json: string, compiler_version: string, renderer_version: string): string;
/**
* Inspect raw image bytes into the same public-safe intake manifest the
* native CLI produces. Returns a JSON `IngredientManifest` (sanitized),
* including the canonical pixel hash and source dimensions.
* @param {string} original_name
* @param {Uint8Array} bytes
* @returns {string}
*/
export function inspect_image_json(original_name: string, bytes: Uint8Array): string;
/**
* Calculate the bounded visual-ingredient record on demand. No reverse
* image or persistent derivative is produced by this call.
* @param {Uint8Array} source_bytes
* @param {number} palette_k
* @returns {string}
*/
export function analyze_ingredients_json(source_bytes: Uint8Array, palette_k: number): string;
/**
* @returns {string}
*/
export function compiler_version(): string;
/**
* @returns {string}
*/
export function rust_toolchain(): string;
/**
* Median-cut palette hex swatches for a source at a given k — the exact
* list `render_reverse` reports as `colour_swatches`, without rendering a
* PNG. Used for live recipe previews (palette slider).
* @param {Uint8Array} source_bytes
* @param {number} k
* @returns {string}
*/
export function palette_preview_json(source_bytes: Uint8Array, k: number): string;
/**
* Render through the same Rust implementation used by the native binary.
* The JSON result carries PNG bytes and the deterministic manifest.
* @param {Uint8Array} source_bytes
* @param {string} settings_json
* @returns {string}
*/
export function render_reverse_json(source_bytes: Uint8Array, settings_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly analyze_ingredients_json: (a: number, b: number, c: number, d: number) => void;
  readonly binding_request_v1_json: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
  readonly build_binding_json: (a: number, b: number, c: number) => void;
  readonly compile_recipe_json: (a: number, b: number, c: number) => void;
  readonly compile_source_json: (a: number, b: number, c: number) => void;
  readonly compiler_version: (a: number) => void;
  readonly inspect_image_json: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly palette_preview_json: (a: number, b: number, c: number, d: number) => void;
  readonly render_reverse_json: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly rust_toolchain: (a: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
