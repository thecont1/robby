# Robby v1

**Robby** is a tiny explainable compiler for text-based visual compositions. A `.robby` script becomes a validated JSON intermediate representation (IR), an obverse composite image, one or two reverse images, and a manifest that records the process graph.

> **Pipeline:** source script → AST → validation → JSON IR → image execution → obverse, reverse, manifest.

> **Build 02:** `robby-compiler-v0.1.0` is a portable Rust crate. The same Rust lexer, parser, validator, and `robby-ir-v1` lowerer power the native CLI and the browser WebAssembly adapter. Download the compiler source as the [`main` branch archive](https://github.com/thecont1/robby/archive/refs/heads/main.zip).

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
| `client/` | React gallery, Rust/WASM source workbench, and authenticated immutable-original intake. |
| `server/originals.ts` | Protected raw-byte JPEG intake; it never decodes, transforms, or renames source bytes. |
| `drizzle/schema.ts` | Metadata-only provenance records for managed original objects. |
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
./target/release/robby check examples/MS202401-Ayodhya0041.robby
./target/release/robby compile examples/MS202401-Ayodhya0041.robby --out output/MS202401-Ayodhya0041.ir.json
```

Human-oriented errors are intentional. For example, a `.robby` file with `place(x: 1.2, y: 0.45)` emits an error explaining that `x` and `y` must be normalized coordinates.

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
  --ir output/MS202401-Ayodhya0041.ir.json \
  --assets-root /absolute/path/to/assets \
  --out-dir output/MS202401-Ayodhya0041
```

If a script requests two reverse modes, the executor writes `-provenance-map` and `-palette-grid` variants derived from the declared reverse filename. The manifest records each emitted path and SHA-256 checksum.

## Run the web application

The web application displays a library of image-objects and keeps the selected record’s process trace alongside the image stage. The browser compiler remains Rust/WASM. A successful editor compilation updates the active IR only; it does **not** render or upload an image. When a visitor explicitly selects **Turn to inverse**, the server reads the checksum-verified immutable original into a temporary workspace, runs the Python executor once, and returns reverse PNG bytes directly in a `Cache-Control: no-store` response. The browser displays those bytes through a revocable `blob:` URL, then discards them when the object turns back or changes. No reverse, manifest, or obverse derivative is uploaded, stored in the database, or assigned a durable URL.

```bash
pnpm dev
```

The gallery starts on an obverse. Selecting another record also starts that record on its obverse. The **Turn to inverse** control (or the `F` key) asks the live compiler for a fresh transient reverse; turning back revokes it. The same authenticated source bytes and validated IR produce byte-identical reverse bytes on repeated requests. The faces are never shown side by side. Left and right arrow keys cycle the library. The historical `examples/*.robby` files remain compact compiler fixtures; active gallery records bind only immutable current JPEG originals.

### Change gallery order

The active gallery sequence is controlled in **`client/src/lib/demoData.ts`**, in the exported `galleryOrder` list. Move an image id earlier or later in that list to change the filmstrip, serial numbers, Previous/Next behavior, keyboard cycling, and full-screen swipe order. Remove an id from that list to hide the specimen without deleting its immutable original.

The viewer validates the selected `.robby` script with the generated **Rust WebAssembly** adapter before it reports `VALID IR · RUST <toolchain>`. The value is not hardcoded in the UI: `build.rs` runs the same `rustc --version` used by Cargo while building the native/WASM compiler and embeds that toolchain label in the generated adapter. The separate `robby-compiler-v0.1.0` value remains the crate release, not the Rust toolchain. Rebuild the adapter from the same library after changing compiler code or the installed Rust toolchain:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.92 --locked
bash scripts/build-wasm.sh
pnpm build
```

The generated `client/src/wasm/` package is intentionally committed because it is the deployable adapter from the Rust source, not a parallel TypeScript implementation of Robby.

### Live web execution boundary

The current live endpoint supports the gallery’s **base-only** scripts and the `palette-grid` or `provenance-map` reverse modes. It limits live canvases to 12 megapixels, permits only registered immutable gallery originals, verifies their byte SHA-256 before execution, serializes CPU rendering, and deletes its per-request workspace before responding. The endpoint returns PNG bytes with source and output SHA-256 response headers, `Cache-Control: no-store`, and no storage write. Cutout-based live rendering remains unavailable until cutout sources receive the same immutable storage registry and audit path as base originals.

## Authentic originals and credential-preserving storage

Authentic source images are **user data, not repository files**. Store them through the web app’s **Authentic originals** intake or the Management UI File Storage panel. The intake accepts original JPEG byte streams only; it does not crop, resize, decode/re-encode, strip metadata, or rename the original basename. Each object is content-addressed by SHA-256 and an immutable metadata record stores its filename, byte length, storage key, and provenance status. The `gallery/` path is ignored intentionally.

The refreshed gallery records an honest raw-byte credential scan beside every source SHA-256. A source without a C2PA/JUMBF marker is labeled `C2PA ABSENT`; a raw marker without an available cryptographic validation pass is labeled `C2PA CANDIDATE`, never as a verified claim. This keeps the gallery’s credential language conservative while preserving every supplied JPEG byte-for-byte.

The **colour signature** is real pixel-derived data from the active compiled obverse: a SHA-256 fingerprint of raw RGB pixels, a SHA-256 fingerprint of its deterministic eight-colour palette, and the displayed palette itself. The current-gallery compiler/executor record and measured catalogue can be regenerated with:

```bash
python3 scripts/build_refreshed_gallery.py
python3 scripts/derive_refreshed_gallery_catalog.py
```

The source-byte audit, signature values, flip-state model, and verification notes remain available in the Build 03 records. No credential assertion in the gallery is stubbed.

## Known v1 boundaries

Version 1 deliberately excludes a custom mask editor, nested groups, text/vector layers, animation, and GPU acceleration. The target is a small, inspectable compiler pipeline whose artifacts are easy to understand and extend.

The **compiler core** is Rust. The separate image executor remains Python/Pillow/OpenCV in v1: it consumes the Rust-produced IR, applies masks and blends, writes obverse/reverse images, and emits the manifest. It is explicitly not presented as the parser, validator, or IR generator. See [`docs/build-02-audit.md`](docs/build-02-audit.md) for the complete runtime audit.

## Verification

The current implementation is covered by Rust lexer/parser/validator/IR tests, release-binary CLI checks, browser WebAssembly compilation checks, deterministic signature regeneration, and end-to-end command paths for six valid examples. See [`docs/testing.md`](docs/testing.md) for the core checks, [`docs/build-02-web.md`](docs/build-02-web.md) for the shared browser compiler proof, [`docs/build-03-audit.md`](docs/build-03-audit.md) for signature and flip verification, [`docs/gallery-revision.md`](docs/gallery-revision.md) for the gallery interaction contract, and the explicit limitations of the deterministic mask adapters.
