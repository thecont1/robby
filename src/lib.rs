//! `troid` is the portable compiler engine and source of truth inside robby.
//!
//! The same lexer, parser, validator, and IR lowerer power the native CLI and
//! the optional WebAssembly adapter used by the browser showcase.

pub mod analysis;
pub mod ast;
pub mod binding;
pub mod error;
pub mod font;
pub mod intake;
pub mod ir;
pub mod lexer;
pub mod parser;
pub mod render;
pub mod validator;

pub use binding::{BindingOptions, BindingResult, BINDING_STATEMENT};
pub use error::{CompileResult, CompilerError};
pub use ir::{Ir, RecipeIr};

/// Compile a Phase 3 recipe through lexing, parsing, validation, and canonical lowering.
pub fn compile_recipe_source(source: &str) -> CompileResult<RecipeIr> {
    let tokens = lexer::lex(source)?;
    let recipe = parser::parse_recipe(&tokens)?;
    validator::validate_recipe(&recipe)?;
    Ok(ir::lower_recipe(&recipe))
}

/// Compile source text through every explicit compiler pass.
pub fn compile_source(source: &str) -> CompileResult<Ir> {
    let tokens = lexer::lex(source)?;
    let ast = parser::parse(&tokens)?;
    validator::validate(&ast)?;
    Ok(ir::lower(&ast, source))
}

/// Inspect raw source bytes into a deterministic, public-safe intake manifest.
///
/// This is the shared native/WASM path that yields the canonical pixel hash
/// and the source dimensions shown in the browser Measure station. The public
/// projection redacts GPS/EXIF/IPTC/XMP values and neutralizes C2PA claim
/// metadata, so only reproducibility fingerprints cross into the browser.
pub fn inspect_image_json(original_name: &str, bytes: &[u8]) -> CompileResult<String> {
    let manifest = intake::inspect_image(original_name, bytes)?;
    let public = manifest.sanitize_public();
    serde_json::to_string(&public).map_err(|error| {
        CompilerError::plain(format!("Unable to serialize intake manifest: {error}"))
    })
}

/// Calculate the bounded visual-ingredient record used by the optional
/// Ingredients tab. This performs no image rendering and stores no derivative.
pub fn analyze_ingredients_json(bytes: &[u8], palette_k: u8) -> CompileResult<String> {
    analysis::analyze_image_json(bytes, palette_k)
}

/// The GPS-seeded coarse terrain field on its own — `null` when the source
/// carries no usable GPS coordinates. Derived evidence; raw coordinates
/// never leave this module.
pub fn generalized_terrain_json(bytes: &[u8]) -> CompileResult<String> {
    analysis::generalized_terrain_json(bytes)
}

/// Build the authoritative `BindingRecord` for a v1 gallery compile from a
/// canonical binding request JSON (ADR-003 / Plan 9A).
///
/// The request carries every identity domain explicitly; this entry point
/// only validates, runs the one canonical algorithm, and serializes the
/// record. It never derives inputs from browser state.
pub fn build_binding_json(request_json: &str) -> CompileResult<String> {
    let request: binding::CanonicalBindingRequest =
        serde_json::from_str(request_json).map_err(|error| {
            CompilerError::plain(format!("Invalid canonical binding request: {error}"))
        })?;
    let record = binding::build_binding_record(&request).map_err(CompilerError::plain)?;
    serde_json::to_string(&record).map_err(|error| {
        CompilerError::plain(format!("Unable to serialize binding record: {error}"))
    })
}

/// Build a canonical binding request for the active `robby-ir-v1` language in
/// Rust, from the raw pieces the browser legitimately holds: the public-safe
/// intake manifest, the authored recipe source, structured selected evidence,
/// and runtime identities (Plan 9A / P9A.5).
///
/// The recipe is re-compiled here (parse → validate → lower) so the canonical
/// recipe identity is always Rust-derived, never UI formatting.
pub fn binding_request_v1_json(
    intake_json: &str,
    recipe_source: &str,
    evidence_json: &str,
    compiler_version: &str,
    renderer_version: &str,
) -> CompileResult<String> {
    use sha2::Digest;
    let intake: intake::IngredientManifest = serde_json::from_str(intake_json)
        .map_err(|error| CompilerError::plain(format!("Invalid intake manifest: {error}")))?;
    let evidence: binding::SelectedEvidence = serde_json::from_str(evidence_json)
        .map_err(|error| CompilerError::plain(format!("Invalid selected evidence: {error}")))?;
    evidence.validate().map_err(CompilerError::plain)?;
    let ir = compile_source(recipe_source)?;
    let authored_recipe_sha256 = format!("{:x}", sha2::Sha256::digest(recipe_source.as_bytes()));
    let request = binding::binding_request_from_ir_v1(
        &intake,
        &ir,
        &authored_recipe_sha256,
        &binding::V1DisclosurePolicy::default_v1(),
        &evidence,
        compiler_version,
        renderer_version,
    );
    serde_json::to_string(&request).map_err(|error| {
        CompilerError::plain(format!("Unable to serialize binding request: {error}"))
    })
}

/// A stable human-readable version for the CLI, manifest UI, and WASM bridge.
pub const COMPILER_VERSION: &str = "robby-compiler-v0.1.0";

/// Toolchain metadata captured from Cargo's active `rustc` during this build.
/// Browser code cannot inspect a visitor's local toolchain, so this carries the
/// authoritative compiler used to build the shipped native/WASM artifact.
pub const RUST_TOOLCHAIN: &str = env!("ROBBY_RUST_TOOLCHAIN");

#[cfg(feature = "wasm")]
mod wasm {
    use wasm_bindgen::prelude::*;

    use crate::render::{self, render_reverse, RenderSettings};
    use crate::{
        analysis::analyze_image_json as analyze_ingredients,
        binding_request_v1_json as build_v1_request,
        build_binding_json as build_binding_record_json, compile_recipe_source, compile_source,
        inspect_image_json as inspect, COMPILER_VERSION, RUST_TOOLCHAIN,
    };

    /// Compile Robby source in the browser using this exact Rust library.
    #[wasm_bindgen]
    pub fn compile_source_json(source: &str) -> Result<String, JsValue> {
        let ir = compile_source(source).map_err(|error| JsValue::from_str(&error.to_string()))?;
        serde_json::to_string(&ir).map_err(|error| JsValue::from_str(&error.to_string()))
    }

    /// Compile the versioned object-block recipe language in the browser.
    #[wasm_bindgen]
    pub fn compile_recipe_json(source: &str) -> Result<String, JsValue> {
        let ir =
            compile_recipe_source(source).map_err(|error| JsValue::from_str(&error.to_string()))?;
        serde_json::to_string(&ir).map_err(|error| JsValue::from_str(&error.to_string()))
    }

    /// Build the authoritative canonical `BindingRecord` from a JSON
    /// `CanonicalBindingRequest`. One algorithm, shared with the native CLI.
    #[wasm_bindgen]
    pub fn build_binding_json(request_json: &str) -> Result<String, JsValue> {
        build_binding_record_json(request_json)
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }

    /// Build the canonical v1 binding request in Rust from the public-safe
    /// intake manifest, authored recipe source, and structured evidence.
    #[wasm_bindgen]
    pub fn binding_request_v1_json(
        intake_json: &str,
        recipe_source: &str,
        evidence_json: &str,
        compiler_version: &str,
        renderer_version: &str,
    ) -> Result<String, JsValue> {
        build_v1_request(
            intake_json,
            recipe_source,
            evidence_json,
            compiler_version,
            renderer_version,
        )
        .map_err(|error| JsValue::from_str(&error.to_string()))
    }

    /// Inspect raw image bytes into the same public-safe intake manifest the
    /// native CLI produces. Returns a JSON `IngredientManifest` (sanitized),
    /// including the canonical pixel hash and source dimensions.
    #[wasm_bindgen]
    pub fn inspect_image_json(original_name: &str, bytes: &[u8]) -> Result<String, JsValue> {
        inspect(original_name, bytes).map_err(|error| JsValue::from_str(&error.to_string()))
    }

    /// Calculate the bounded visual-ingredient record on demand. No reverse
    /// image or persistent derivative is produced by this call.
    #[wasm_bindgen]
    pub fn analyze_ingredients_json(source_bytes: &[u8], palette_k: u8) -> Result<String, JsValue> {
        analyze_ingredients(source_bytes, palette_k)
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }

    /// The GPS-seeded coarse terrain field on its own — `null` when the
    /// source carries no usable GPS coordinates.
    #[wasm_bindgen]
    pub fn generalized_terrain_json(source_bytes: &[u8]) -> Result<String, JsValue> {
        crate::generalized_terrain_json(source_bytes)
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }

    #[wasm_bindgen]
    pub fn compiler_version() -> String {
        COMPILER_VERSION.to_string()
    }

    #[wasm_bindgen]
    pub fn rust_toolchain() -> String {
        RUST_TOOLCHAIN.to_string()
    }

    /// Median-cut palette hex swatches for a source at a given k — the exact
    /// list `render_reverse` reports as `colour_swatches`, without rendering a
    /// PNG. Used for live recipe previews (palette slider).
    #[wasm_bindgen]
    pub fn palette_preview_json(source_bytes: &[u8], k: u8) -> Result<String, JsValue> {
        let swatches = render::palette_preview(source_bytes, k)
            .map_err(|error| JsValue::from_str(&error.to_string()))?;
        serde_json::to_string(&swatches).map_err(|error| JsValue::from_str(&error.to_string()))
    }

    /// Render through the same Rust implementation used by the native binary.
    /// The JSON result carries PNG bytes and the deterministic manifest.
    #[wasm_bindgen]
    pub fn render_reverse_json(
        source_bytes: &[u8],
        settings_json: &str,
    ) -> Result<String, JsValue> {
        let settings: RenderSettings = serde_json::from_str(settings_json)
            .map_err(|error| JsValue::from_str(&format!("Invalid render settings: {error}")))?;
        let result = render_reverse(source_bytes, &settings)
            .map_err(|error| JsValue::from_str(&error.to_string()))?;
        serde_json::to_string(&(result.png, result.manifest))
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::{compile_source, lexer, parser, validator};

    const VALID: &str = r#"
base("base.jpg", width: 1280, height: 720)
palette(k: 8)
reverse(mode: "negative")
output(obverse: "front.png", reverse: "transient", manifest: "transient")
"#;

    #[test]
    fn lexes_parser_tokens_before_ast_construction() {
        let tokens = lexer::lex("base(\"image.jpg\")\n").expect("tokens");
        let ast = parser::parse(&tokens).expect("AST");
        assert_eq!(ast.commands.len(), 1);
        assert_eq!(ast.commands[0].name, "base");
    }

    #[test]
    fn rejects_backslash_followed_by_a_real_newline_in_a_string() {
        let error = lexer::lex("base(\"first\\\nsecond\")\n").unwrap_err();
        assert!(error.message.contains("Unterminated string literal"));
    }

    #[test]
    fn lowers_a_valid_script_to_stable_ir() {
        let ir = compile_source(VALID).expect("valid v1 script");
        assert_eq!(ir.version, "robby-ir-v1");
        assert_eq!(ir.palette.k, 8);
        assert_eq!(ir.reverse.mode, "negative");
    }

    #[test]
    fn requires_base_as_first_command() {
        let error = compile_source("reverse(mode: \"negative\")").unwrap_err();
        assert!(error.message.contains("Missing `base` command"));
    }

    #[test]
    fn rejects_removed_commands() {
        for command in [
            "cutout(source: \"rider.png\", mask: \"person\", id: \"rider\")",
            "place(cutout: \"rider\", x: 0.5, y: 0.5)",
        ] {
            let source = VALID.replace("palette(k: 8)", &format!("{command}\npalette(k: 8)"));
            let error = compile_source(&source).unwrap_err();
            assert!(error.message.contains("Unknown command"));
        }
    }

    #[test]
    fn rejects_invalid_palette_count() {
        let source = VALID.replace("palette(k: 8)", "palette(k: -3)");
        let error = compile_source(&source).unwrap_err();
        assert!(error.message.contains("integer between 3 and 64"));
    }

    #[test]
    fn validator_accepts_base_only_palette_scripts() {
        let source = r#"base("image.jpg")
palette(k: 6)
reverse(mode: "negative")
output(obverse: "front.png", reverse: "transient", manifest: "transient")"#;
        let tokens = lexer::lex(source).expect("tokens");
        let ast = parser::parse(&tokens).expect("AST");
        validator::validate(&ast).expect("valid gallery script");
    }

    #[test]
    fn rejects_a_second_base_command() {
        let source = VALID.replace("palette(k: 8)", "base(\"other.jpg\")\npalette(k: 8)");
        let error = compile_source(&source).unwrap_err();
        assert!(error.message.contains("Exactly one `base(...)`"));
    }

    #[test]
    fn rejects_unknown_reverse_mode() {
        let source = VALID.replace("negative", "unknown-mode");
        let error = compile_source(&source).unwrap_err();
        assert!(error.message.contains("Unknown reverse mode"));
    }

    #[test]
    fn rejects_duplicate_reverse_declarations() {
        let source = VALID.replace(
            "reverse(mode: \"negative\")",
            "reverse(mode: \"negative\")\nreverse(mode: \"negative\")",
        );
        let error = compile_source(&source).unwrap_err();
        assert!(error.message.contains("Exactly one `reverse(...)`"));
    }
}
