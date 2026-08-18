# Robby v1 verification record

The checks below were run against the initial `robby` v1 implementation after the compiler, executor, generated outputs, and viewer were connected.

| Area | Command or action | Result |
| --- | --- | --- |
| Parser and validator | `cargo test` | Passed: 4 tests covering valid IR lowering, missing `base`, invalid normalized coordinates, and unsupported masks. |
| Valid composition | `cargo run -- compile examples/MS202401-Ayodhya0041.robby --out output/MS202401-Ayodhya0041.ir.json` | Passed: emitted `robby-ir-v1`. |
| Palette-grid reverse | `uv run python executor/run.py --ir output/MS202401-Ayodhya0041.ir.json …` | Passed: emitted one obverse, palette-grid reverse, and manifest. |
| Human error | `cargo run -- check` on a `.robby` file with `place(x: 1.2, y: 0.45)` | Failed as expected with the normalized-coordinate error. |
| Viewer type safety | `pnpm check` | Passed. |
| Production build | `pnpm build` | Passed. Vite reports only its non-blocking chunk-size advisory. |
| Output integrity | `file` inspection of generated PNGs | Passed: every checked output is a valid 1440 × 1080 RGB PNG. |

## Masking note

The v1 executor transparently distinguishes supplied alpha masks from its deterministic image adapters. Transparent source artwork retains the alpha channel. Opaque `person` assets use **OpenCV GrabCut auto-foreground**; opaque `sky` assets use a **top-connected colour heuristic**. Both are fully recorded in the manifest as `mask_strategy` so neither the reverse image nor the interface pretends that a more capable semantic model was used.

For future work, the `make_mask` function is intentionally a single adapter boundary: a dedicated local person or sky segmentation model can replace the v1 heuristics without changing the DSL, IR, manifest schema, renderer, or viewer.
