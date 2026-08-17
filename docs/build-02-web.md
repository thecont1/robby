# Build 02 — web integration

The browser now imports the generated `robby_compiler` WebAssembly package from `client/src/wasm/`. That package is generated from the `robby-compiler` Rust library with the `wasm` feature enabled; it exports `compile_source_json` and `compiler_version` from the same lexer, parser, validator, and IR lowerer that back the native CLI.

The gallery stores the exact source text for each displayed `.robby` example. Whenever the selected record changes, the React view initializes the Rust module (if required), compiles that source to JSON in-browser, and accepts the item only when the returned schema version is `robby-ir-v1`. The header reports `VALID IR · RUST v0.1.0` after this succeeds.

The live browser verification confirmed all of the following:

| Surface | Observed state |
| --- | --- |
| Browser compiler status | `VALID IR · RUST v0.1.0` |
| Source access | Persistent `DOWNLOAD RUST SOURCE` link to `https://github.com/thecont1/robby/tree/dev/ananya` |
| Manifest strip | `CORE: RUST · robby-compiler-v0.1` alongside the separate CPU/Pillow/OpenCV executor declaration |
| Web artifact | Vite production build emits the generated `robby_compiler_bg.wasm` asset |

The navigation check then selected `Ayodhya mural`, whose distinct base-only `.robby` script was recompiled by the already loaded Rust module. The gallery retained `VALID IR · RUST v0.1.0`, demonstrating that the browser verification is tied to the selected source rather than only the initial record.

The gallery and its Python image executor remain distinct from the browser compiler. The browser does not execute imagery or fabricate IR in TypeScript; it only calls the Rust WebAssembly compiler for parse, validation, and JSON IR lowering.
