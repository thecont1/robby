# Build 02 audit — compiler runtime boundaries

This audit describes the repository state before the Build 02 refactor. The website is a presentation layer; it is not the compiler.

| Responsibility | Current implementation | Runtime | Build 02 assessment |
| --- | --- | --- | --- |
| Lexing, parsing, semantic validation, and IR lowering | One monolithic Rust file: `src/main.rs` | Native Rust CLI only | **Rust already owns the logic**, but the code is not yet split into inspectable lexer, parser, validator, and IR modules. |
| Native compiler command | `cargo run -- compile script.robby --out ir.json` | Native Rust binary | Works without a browser, but must be formalised as a reusable library plus a small CLI wrapper. |
| Image execution and manifest rendering | `executor/run.py` using Pillow, NumPy, and OpenCV | Python 3 via `uv run` | **Non-Rust by design in v1.** It consumes Rust-produced `robby-ir-v1`; it is an executor, not the parser/compiler core. |
| Live website | React/TypeScript gallery in `client/src/` | Browser via Vite | Displays precomputed images and manifest-shaped display data. It does **not** parse `.robby`, validate source, lower IR, call a Rust binary, or invoke the Python executor. |
| Browser compiler integration | None | None | No WebAssembly artifact, Rust import, or backend compile endpoint exists yet. |
| Backend fallback | None | None | This static project has no server route that can invoke the native binary. |

## Build 02 decision

The compiler core will become a Rust library with explicit `lexer`, `parser`, `validator`, and `ir` modules. The same library will support two adapters: the native `robby` CLI and a small `wasm-bindgen` API for browser validation and IR generation. The React app will call that generated WebAssembly interface when it verifies each selected gallery script.

The Python executor remains the only non-Rust part of the compilation-to-image pipeline. It is clearly identified as an **IR executor** and will not be presented as the compiler core. Replacing it is outside this blocking Build 02 scope.
