# Pull request report — Build 04 and Build 05

## Purpose

This pull request requests review of the compiler hardening completed in **Build 04** and the compiler-visibility work completed in **Build 05**. It is intentionally left unmerged while CodeRabbit and ITO-QA review the branch in that order.

## Review baseline

The normal `main` branch already contains the Build 05 checkpoint because the project’s automatic publishing workflow advanced it before this review request was opened. To give review tooling the intended complete diff, this request targets the frozen `review/ananya-base` branch at checkpoint `40e9af6`, which predates Build 04 and Build 05. It is a **review-only baseline**; do not merge the pull request into that branch.

## Included logical batches

| Commit | Batch | Scope |
| --- | --- | --- |
| `4f6137a` | Rust compiler core | Modular lexer, parser, validator, IR, CLI, and shared WebAssembly bridge. |
| `226edc8` | Credential and colour signatures | Per-specimen C2PA absence records, pixel/palette signatures, and a declarative flip repair. |
| `1066d04` | Verification and integrity | Downloadable Rust source archive, C2PA cross-check, real script/output hashes, and regression records. |
| `302f41a` | Source editor and language manual | Real Rust/WASM editor, inline diagnostics, IR-derived trace/manifest preview, and versioned six-command reference. |
| `c980a3c` | Review workflow | Review-order checklist and audit status tracking. |

## Verification evidence

The native Rust crate built from the GitHub branch archive and compiled a `.robby` script into `robby-ir-v1` without browser involvement. The browser editor calls the same `compile_source_json` Rust/WASM export; it has no JavaScript parser, validator, or IR fallback. A valid edited source updated the live trace and manifest targets, and an invalid `mask: "sky2"` source returned the authored Rust line diagnostic.

The five gallery specimens were exercised for Rust/WASM validation, signatures, selection, keyboard navigation, and obverse/inverse transitions. Manifest and gallery SHA-256 values were checked against actual script and obverse bytes. All five supplied original assets returned `No claim found` through `c2patool`, so the visible C2PA state is `C2PA ABSENT` rather than an unsupported verification claim.

## Known runtime boundary

The frontend-only deployment compiles edited source to real Rust IR in-browser. It does not run the separate Python/Pillow/OpenCV executor for arbitrary edits, so edited image pixels remain the selected pre-rendered gallery artifact and are labelled `STATIC ARTIFACT · RENDER PENDING`. This is an explicit runtime boundary, not a silent fallback.

## Requested review order

1. CodeRabbit: compiler boundary, browser Rust/WASM path, static artifact labelling, and type/error handling.
2. ITO-QA: gallery regression, editor success/error flows, manual completeness, accessibility, and documented runtime limits.
