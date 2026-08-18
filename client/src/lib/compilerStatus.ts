/** The Rust toolchain that builds Robby's native and WebAssembly compiler core. */
export const RUST_TOOLCHAIN_VERSION = "1.97.1";

/** Header status shown only after the WebAssembly compiler validates the active script. */
export const verifiedCompilerStatus = `VALID IR · RUST ${RUST_TOOLCHAIN_VERSION}`;
