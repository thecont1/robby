# Gallery revision checklist

- [x] Register the four supplied obverse photographs as durable gallery assets with clear titles and manifest identities.
- [x] Produce a provenance-map reverse and process manifest for each new gallery record.
- [x] Upload obverse and reverse artifacts to project storage for static viewer access.
- [x] Replace the paired-image spread with one mutually exclusive flippable image-object and gallery navigation.
- [x] Keep the active image’s compilation trace visible beside the image-object and synchronize it with gallery selection.
- [x] Verify previous/next cycling, flip state, keyboard access, mobile layout, production build, and updated documentation.

## Filmstrip refinement

- [x] Move the image-library thumbnails below the selected image-object and expand the desktop stage to fit the active face to the available width.
- [x] Confirm that the bottom filmstrip remains navigable and responsive without narrowing the adjacent compilation trace.

## Build 02 — Rust compiler core

- [x] Audit and document the current language/runtime for parsing, validation, IR lowering, execution, and viewer behavior.
- [x] Refactor the Rust compiler into inspectable lexer, parser, validator, IR, and CLI modules without changing `robby-ir-v1`.
- [x] Verify the portable native CLI builds and compiles example `.robby` scripts without browser or web deployment dependencies.
- [x] Compile the same Rust parser/validator/IR source to WebAssembly and use it in the viewer rather than parallel TypeScript logic.
- [x] Add a persistent site link to the actual Rust source on the `dev/ananya` repository branch and state the Rust core explicitly in the footer/manifest area.
- [x] Record remaining non-Rust runtime responsibilities and Build 02 verification results.

## Build 03 — credential and colour signature layer

- [x] Audit the five source assets for embedded C2PA indicators and record exactly what can be verified locally.
- [x] Derive and record a real pixel-based colour signature for every gallery specimen.
- [x] Add per-specimen credential and colour signature fields to the trace and manifest presentation.
- [x] Replace the flip animation with a locked, declarative `face` / `isFlipping` state machine and preloaded 3D faces.
- [x] Verify flip stability, signature updates, gallery cycling, source-data provenance, and responsive presentation.
- [x] Document C2PA verification limits and distinguish real asset-derived data from UI-only absence states.

## Build 04 — verification and hardening

- [x] Verify the public Rust source link and build the crate from a clean clone using the documented native CLI path.
- [x] Confirm every gallery specimen compiles through the same Rust/WASM source with no JavaScript parser or IR fallback.
- [x] Audit credential and colour signature values, source metadata badge states, and palette changes across all five specimens.
- [x] Exercise thumbnail, previous/next, and keyboard navigation plus obverse/inverse flips for every specimen.
- [x] Verify or repair script hashes and output checksums against actual bytes, recording any intentionally unavailable values.
- [x] Run final native, WebAssembly, browser, and production-build regressions and publish a concise Build 04 findings report.
