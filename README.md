# Robby v1

**Robby** is a tiny explainable compiler for text-based visual compositions. A `.robby` script becomes a validated JSON intermediate representation (IR), an obverse composite image, one or two reverse images, and a manifest that records the process graph.

> **Pipeline:** source script → AST → validation → JSON IR → image execution → obverse, reverse, manifest.

> **Build 02:** `robby-compiler-v0.1.0` is a portable Rust crate. The same Rust lexer, parser, validator, and `robby-ir-v1` lowerer power the native CLI and the browser WebAssembly adapter. Download the compiler source as the [`dev/ananya` branch archive](https://github.com/thecont1/robby/archive/refs/heads/dev/ananya.zip).

The v1 compiler keeps its grammar deliberately small. It is designed to make a photographic composition traceable, not to become a general-purpose graphics program.

## Repository map

| Path | Purpose |
| --- | --- |
| `src/lexer.rs` | Source text → tokens. |
| `src/parser.rs` | Tokens → AST. |
| `src/validator.rs` | Semantic checks and human-readable diagnostics. |
| `src/ir.rs` | Validated AST → `robby-ir-v1` JSON. |
| `src/lib.rs` | Shared public compiler API and optional WebAssembly exports. |
| `src/main.rs` | Thin native `robby` CLI adapter. |
| `executor/run.py` | Python/Pillow CPU executor, reverse renderers, palette analysis, and manifest writer. |
| `examples/*.robby` | Valid and invalid scripts that exercise v1 language features. |
| `client/` | Static React viewer for a generated composition and its process graph. |
| `scripts/build-wasm.sh` | Rebuilds the deployable browser adapter from the Rust library. |

## Command language

Every script starts with exactly one `base(...)` command and ends with exactly one `output(...)` command. The supported operations are `base`, `cutout`, `place`, `palette`, `reverse`, and `output`.

```text
base("night-street.jpg", width: 1440, height: 1080)
cutout(source: "courier.png", mask: "person", id: "courier")
place(cutout: "courier", x: 0.72, y: 0.64, scale: 0.92, blend: "normal")
palette(k: 8)
reverse(mode: "provenance-map")
reverse(mode: "palette-grid", k: 8)
output(obverse: "night-obverse.png", reverse: "night-reverse.png", manifest: "night-manifest.json")
```

`x` and `y` are normalized composition coordinates, from `0.0` through `1.0`. Version 1 accepts only `person` and `sky` masks; blend modes are `normal`, `multiply`, `screen`, and `overlay`.

## Compile a script without a browser

Build the portable native Rust binary once, then lower a local `.robby` script into JSON IR. This needs no browser, web server, or deployed website.

```bash
cargo build --release
./target/release/robby version
./target/release/robby check examples/night-duality.robby
./target/release/robby compile examples/night-duality.robby --out output/night-duality.ir.json
```

Human-oriented errors are intentional. For example, `examples/invalid-coordinate.robby` emits an error explaining that `x` and `y` must be normalized coordinates.

## IR outline

The compiler emits `robby-ir-v1`. Its stable top-level fields are `canvas`, `cutouts`, `layers`, `palette`, `reverse`, and `output`; `meta.script_sha256` links the IR to the exact source text that produced it.

```json
{
  "version": "robby-ir-v1",
  "canvas": { "base": "night-street.jpg", "width": 1440, "height": 1080 },
  "cutouts": [{ "id": "courier", "source": "courier.png", "mask": "person" }],
  "layers": [{ "cutout": "courier", "x": 0.72, "y": 0.64, "scale": 0.92, "rotation": 0.0, "opacity": 1.0, "blend": "normal" }],
  "palette": { "k": 8 },
  "reverse": [{ "mode": "provenance-map", "k": null }],
  "output": { "obverse": "front.png", "reverse": "back.png", "manifest": "manifest.json" }
}
```

## Execute the IR

The executor runs on the CPU with Pillow, NumPy, and OpenCV. It first honours a source image’s transparency when present. For opaque real photographs, `person` masks use an OpenCV GrabCut auto-foreground adapter, while `sky` uses a deterministic top-connected sky heuristic. This keeps the execution stage explicit about the mask strategy chosen in its manifest.

```bash
uv run python executor/run.py \
  --ir output/night-duality.ir.json \
  --assets-root /absolute/path/to/assets \
  --out-dir output/night-duality
```

If a script requests two reverse modes, the executor writes `-provenance-map` and `-palette-grid` variants derived from the declared reverse filename. The manifest records each emitted path and SHA-256 checksum.

## Run the viewer

The React viewer is intentionally static: it displays a compiled library of image-objects and keeps the selected record’s process trace alongside the image stage.

```bash
pnpm dev
```

The gallery starts on an obverse. Selecting another record also starts that record on its obverse. The **Turn to inverse** control (or the `F` key) replaces the stage image with its compiled reverse; the faces are never shown side by side. Left and right arrow keys cycle the library. The supplied examples are generated from `examples/night-duality.robby`, `examples/ayodhya-mural.robby`, `examples/urban-fantasy.robby`, `examples/murgeshpalya-passage.robby`, and `examples/uganda-diptych.robby`.

The viewer validates the selected `.robby` script with the generated **Rust WebAssembly** adapter before it reports `VALID IR · RUST v0.1.0`. Rebuild the adapter from the same library after changing compiler code:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.92 --locked
bash scripts/build-wasm.sh
pnpm build
```

The generated `client/src/wasm/` package is intentionally committed because it is the deployable adapter from the Rust source, not a parallel TypeScript implementation of Robby.

## Build 03 signature layer

Every active gallery specimen now exposes two distinct signatures. The **credential signature** is a conservative local scan of the original asset bytes for C2PA/JUMBF markers. The five supplied originals have no detected embedded marker, so the UI correctly reports `C2PA ABSENT`; it does not fabricate issuer, edit-history, or capture assertions. A future full C2PA validator is required before any asset can be labelled `C2PA VERIFIED`.

The **colour signature** is real pixel-derived data from the active compiled obverse: a SHA-256 fingerprint of raw RGB pixels, a SHA-256 fingerprint of its deterministic eight-colour palette, and the displayed palette itself. Regenerate the committed evidence record with:

```bash
uv run python scripts/derive_signatures.py --out docs/build-03-signatures.json
```

The source-byte audit, signature values, flip-state model, and verification notes are in [`docs/build-03-audit.md`](docs/build-03-audit.md) and [`docs/build-03-signatures.json`](docs/build-03-signatures.json). The C2PA absence state and the colour signature are real local data; no credential assertion in this build is stubbed.

## Known v1 boundaries

Version 1 deliberately excludes a custom mask editor, nested groups, text/vector layers, animation, and GPU acceleration. The target is a small, inspectable compiler pipeline whose artifacts are easy to understand and extend.

The **compiler core** is Rust. The separate image executor remains Python/Pillow/OpenCV in v1: it consumes the Rust-produced IR, applies masks and blends, writes obverse/reverse images, and emits the manifest. It is explicitly not presented as the parser, validator, or IR generator. See [`docs/build-02-audit.md`](docs/build-02-audit.md) for the complete runtime audit.

## Verification

The current implementation is covered by Rust lexer/parser/validator/IR tests, release-binary CLI checks, browser WebAssembly compilation checks, deterministic signature regeneration, and end-to-end command paths for six valid examples. See [`docs/testing.md`](docs/testing.md) for the core checks, [`docs/build-02-web.md`](docs/build-02-web.md) for the shared browser compiler proof, [`docs/build-03-audit.md`](docs/build-03-audit.md) for signature and flip verification, [`docs/gallery-revision.md`](docs/gallery-revision.md) for the gallery interaction contract, and the explicit limitations of the deterministic mask adapters.
