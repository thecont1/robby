# Build 04 verification and hardening report

## Native crate verification

| Check | Status | Evidence |
| --- | --- | --- |
| Public source destination | ✅ real | The existing `Download Rust Source` control now targets `https://github.com/thecont1/robby/archive/refs/heads/dev/ananya.zip`. The GitHub REST archive downloaded successfully, passed `unzip -t`, and unpacked a full Rust crate. |
| Clean native build | ✅ real | A clean local clone of the pushed `dev/ananya` state compiled successfully with `cargo build`. |
| Browser-independent CLI | ✅ real | `cargo run -- version`, `cargo run -- check examples/night-duality.robby`, and `cargo run -- compile examples/night-duality.robby --out /tmp/build04-night.ir.json` all succeeded without the website running. |
| Documented IR | ✅ real | The compiled artifact contains `"version": "robby-ir-v1"`. |

The exact public repository path is `https://github.com/thecont1/robby/tree/dev/ananya`; the direct downloadable branch archive is `https://github.com/thecont1/robby/archive/refs/heads/dev/ananya.zip`. The native verification command is:

```bash
cargo build
cargo run -- check examples/night-duality.robby
cargo run -- compile examples/night-duality.robby --out output/night.ir.json
```

The first GitHub CLI GraphQL clone attempt returned an HTTP 503, but GitHub’s REST archive endpoint succeeded. The downloaded archive unpacked as `thecont1-robby-226edc8`, built with `cargo build`, and compiled `examples/night-duality.robby` to a `robby-ir-v1` document without a browser.

The live page’s `DOWNLOAD RUST SOURCE` link was also inspected after the correction and resolves to the same tested `dev/ananya.zip` archive endpoint.

## Browser audit harness note

The initial aggregate browser test exposed two harness defects, not product defects. Its first reverse-mode matcher used presentation casing that did not match the rendered trace; direct live inspection confirmed `VALID IR · RUST v0.1.0`, `C2PA ABSENT`, `px:9c178fbb6149…`, and `provenance-map` for `Night duality`. Its next run referenced page globals from the Playwright server context. The harness now reads those values through `page.locator` so the full five-specimen run can proceed without weakening assertions.

## C2PA validator cross-check

The marker scan used by Build 03 was supplemented in Build 04 with `c2patool v0.27.15`, a manifest-aware C2PA utility. It returned **`Error: No claim found`** for each original local asset: `night-street.jpg`, `MS202401-Ayodhya0041.webp`, `_DSF0739-Enhanced-NR.webp`, `MS201901-Murgeshpalya0018.webp`, and `MS201508-Uganda0016.webp`.

Therefore the five visible `C2PA ABSENT` badges are accurate asset-specific states. No UI item reports issuer, edit history, or capture data because no embedded C2PA claim exists to support it. The C2PA state is static build evidence in this frontend-only v1 gallery; uploading a new image still requires regenerating the signature records before its badge can be trusted.

## Five-specimen behavior trace

The completed browser trace selected every thumbnail and, for each specimen, verified `VALID IR · RUST v0.1.0`, its own colour fingerprint and reverse mode, a successful obverse-to-inverse turn, a keyboard `F` return to obverse, next/previous control reset, and `ArrowRight`/`ArrowLeft` reset. The active accessible image alt changed from the specimen’s obverse to its matching inverse and back on every cycle. No stale title, trace, signature, or face state was observed.

The source scan also found no JavaScript lexer, parser, validator, or IR lowerer in `client/src/`. The only browser compiler invocation is `compile_source_json(selected.script)` imported from the generated `robby_compiler` WebAssembly package; `JSON.parse` only reads the Rust-returned IR string.

## Manifest integrity

Build 04 found and repaired one integrity defect: four gallery `outputHash` values were decorative strings (`executor output · checksum recorded`) and the display values were stored pre-truncated. They are now full SHA-256 strings calculated from the actual compiled obverse PNGs. The UI shows compact leading/trailing excerpts but retains the full value in the source data and the trace item’s title attribute.

`scripts/verify_build04_integrity.py` then verified all five specimens against their local generated manifests. For every specimen, the actual `.robby` script SHA-256 matched the manifest and gallery record, and the actual compiled-obverse SHA-256 matched the manifest and gallery record. The generated machine-readable record is [`build-04-integrity.json`](build-04-integrity.json).

| Specimen | Credential marker | Script hash | Obverse output hash | Result |
| --- | --- | --- | --- | --- |
| Night duality | absent | 249ff423…49388581 | 6c73907f…f3597d89f | all checks true |
| Ayodhya mural | absent | c692e96c…05b64c915 | 64aedad3…463699d5 | all checks true |
| Urban fantasy | absent | 75c1cdf2…aa2289f53 | 06157b18…fcdcdc4b | all checks true |
| Murgeshpalya passage | absent | 4a190307…18cc86b23 | 6c5ce68c…103cc8b8 | all checks true |
| Uganda diptych | absent | 764c5592…df22ad5d6 | 1e66213b…cee7d6b6 | all checks true |

## Final browser state

The archive-download click opened a transient download context, so the final browser inspection was reset to the live gallery URL before checking runtime messages. This keeps the console result scoped to the actual viewer rather than `about:blank`.

The reopened live gallery completed Rust/WASM initialization with **0 browser errors** and **0 browser warnings**. The advisory design review was not applied because Build 04 explicitly prohibits visual redesign; the only UI change was the correctness fix that makes the existing source-download control deliver the tested archive.
