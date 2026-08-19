# robby work ledger

## Completed architecture

- [x] Use one Rust compiler core for source parsing, validation, IR lowering, and deterministic rendering.
- [x] Expose the compiler core through native and WASM targets.
- [x] Restrict v1 to `base`, optional bounded `palette(k)`, `reverse(mode: "negative")`, and transient `output`.
- [x] Remove semantic image interpretation and the retired Python image executor.
- [x] Generate every reverse on an explicit obverse-to-reverse turn.
- [x] Return reverse PNG bytes and reproducibility metadata with `Cache-Control: no-store`.
- [x] Remove durable reverse-image paths and local signing/export code.
- [x] Remove external platform auth, storage, database, runtime, and debug coupling.
- [x] Serve original JPEGs from one configurable watched gallery root.
- [x] Reject traversal and symbolic links; isolate invalid optional sidecars.
- [x] Package the native Rust renderer in production builds and containers.

## Verification completed for this work order

- [x] Regenerate WASM with pinned `wasm-bindgen` and commit generated bindings.
- [x] Prove byte-identical native/WASM PNG and manifest results for five settings, including `k=3` and `k=16`.
- [x] Run Rust formatting, build, Clippy, and all Rust tests.
- [x] Run TypeScript static checks, all Vitest tests, and the production build.
- [x] Exercise gallery listing, JPEG serving, reverse rendering, removed routes, and request-size rejection against the production server.
- [x] Compare tracked/untracked filesystem state before and after rendering to prove no reverse artifact was written.
- [x] Record final evidence and remaining uncertainty in the work-order report.

## Explicitly deferred

- MCP server and WebMCP integration.
- A generalized arbitrary-JPEG image-object viewer.
