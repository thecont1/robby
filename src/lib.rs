//! `robby-compiler` is the portable source of truth for Robby v1.
//!
//! The same lexer, parser, validator, and IR lowerer power the native CLI and
//! the optional WebAssembly adapter used by the browser showcase.

pub mod ast;
pub mod error;
pub mod ir;
pub mod lexer;
pub mod parser;
pub mod render;
pub mod validator;

pub use error::{CompileResult, CompilerError};
pub use ir::Ir;

/// Compile source text through every explicit compiler pass.
pub fn compile_source(source: &str) -> CompileResult<Ir> {
    let tokens = lexer::lex(source)?;
    let ast = parser::parse(&tokens)?;
    validator::validate(&ast)?;
    Ok(ir::lower(&ast, source))
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

    use crate::render::{render_reverse, RenderSettings};
    use crate::{compile_source, COMPILER_VERSION, RUST_TOOLCHAIN};

    /// Compile Robby source in the browser using this exact Rust library.
    #[wasm_bindgen]
    pub fn compile_source_json(source: &str) -> Result<String, JsValue> {
        let ir = compile_source(source).map_err(|error| JsValue::from_str(&error.to_string()))?;
        serde_json::to_string(&ir).map_err(|error| JsValue::from_str(&error.to_string()))
    }

    #[wasm_bindgen]
    pub fn compiler_version() -> String {
        COMPILER_VERSION.to_string()
    }

    #[wasm_bindgen]
    pub fn rust_toolchain() -> String {
        RUST_TOOLCHAIN.to_string()
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
output(obverse: "front.png", reverse: "back.png", manifest: "manifest.json")
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
        assert!(error.message.contains("integer between 3 and 16"));
    }

    #[test]
    fn validator_accepts_base_only_palette_scripts() {
        let source = r#"base("image.jpg")
palette(k: 6)
reverse(mode: "negative")
output(obverse: "front.png", reverse: "back.png", manifest: "manifest.json")"#;
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
