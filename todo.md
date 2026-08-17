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
