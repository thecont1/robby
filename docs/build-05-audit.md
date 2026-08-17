# Build 05 audit — editor and manual boundary

The live editor will invoke `compile_source_json(source)` from the generated `robby_compiler` WebAssembly package. That binding is a thin bridge to the same Rust `lexer → parser → validator → IR` pipeline used by the native CLI; it has no JavaScript parser or validator fallback.

On a successful edit, the static viewer can immediately update its **compilation trace**, **script SHA-256**, **reverse mode**, and **output target names** from the returned `robby-ir-v1` object. The gallery images themselves are pre-rendered artifacts produced by the separate Python/Pillow/OpenCV executor. This frontend-only deployment cannot regenerate a new obverse or inverse bitmap from arbitrary edited source, so it will retain the selected specimen’s rendered faces and label that state explicitly as `STATIC ARTIFACT · RENDER PENDING`.

This distinction is intentional. The editor never pretends that an edited script has produced new image pixels; it demonstrates the genuine Rust compiler pass and surfaces its success or line-aware failure directly.

## Test environment

The existing public domain serves the prior Build 04 checkpoint until Build 05 is saved. Build 05 interaction tests therefore run against the active development preview, which contains the uncheckpointed editor and manual route. The final checkpoint will publish this tested revision to the domain.

The active preview exposed a `Compile with Rust` control next to the selected Night duality script and the rendered text `WASM bridge → Rust lexer / parser / validator / IR`. The valid source was submitted through that control for the success-state inspection that follows.

The resulting status read **`Valid robby-ir-v1` from the Rust core.** It also states that the trace and manifest targets reflect the source while the gallery bitmap remains the pre-rendered specimen artifact. This is the intended truthful static-execution boundary.

The active source was then replaced with a four-line script whose `cutout` command uses the unsupported `mask: "sky2"`. That edited source was submitted through the same `Compile with Rust` control for failure-state verification.

The editor rendered the inline Rust diagnostic **`Error on line 2: Unknown mask type sky2. v1 supports person and sky.`** in its alert state. It then accepted a valid, deliberately altered script declaring `palette(k: 7)`, `reverse(mode: "palette-grid", k: 7)`, and `edited-obverse.png` / `edited-manifest.json` output targets for the live IR-preview verification that follows.

The live trace showed the edited `output_target` and `manifest_target`, confirming the real Rust-returned IR updated the compilation record. The gallery header also exposes a persistent `LANGUAGE MANUAL` link at `/manual` beside the existing Rust source download.

The manual route loaded successfully and its command index reached `06 · output`. The output entry exposed its syntax signature, required `obverse` / `reverse` / `manifest` arguments, the final-command rule, and a Night duality example. The same versioned reference contains the complete v0.1 sequence: `base`, `cutout`, `place`, `palette`, `reverse`, and `output`.

Desktop and narrow mobile previews confirmed that the source editor, compile/reset controls, trace, and manual tables remain readable in the established cream/charcoal/vermilion system. The visual review suggested making both image faces materially present; that conflicts with the approved rule that obverse and inverse cannot be observed at the same time, so Build 05 preserves the existing mutually exclusive object and flip mechanics.

The manual’s `RETURN TO GALLERY` link returned successfully to the gallery route before the final existing-flip regression.

The gallery then exposed its existing `Flip Night duality to its inverse` control and accepted an inverse-turn action after returning from the manual.

After the turn, the control changed to `Return Night duality to its obverse`, confirming the same approved mutually exclusive face state remains active. No gallery, credential-signature, or Rust-source-download control was replaced by Build 05.

## Final regression

The final Build 05 suite passed: all nine Rust compiler tests, a reproducible `scripts/build-wasm.sh` generation, TypeScript checking, and the production Vite build. The browser editor invokes `compileWithRust`, whose only compile operation is the generated `compile_source_json(source)` Rust/WebAssembly export. There is **no JavaScript parser, validator, or IR generator fallback** in the editor.

The only intentionally unavailable capability is image re-execution for arbitrary edited text: the static gallery has no deployed Python executor. This is labelled `STATIC ARTIFACT · RENDER PENDING` whenever the live Rust IR differs from the selected specimen source; it is not a silent stub.
