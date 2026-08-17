# Robby v1

**Robby** is a tiny explainable compiler for text-based visual compositions. A `.robby` script becomes a validated JSON intermediate representation (IR), an obverse composite image, one or two reverse images, and a manifest that records the process graph.

> **Pipeline:** source script → AST → validation → JSON IR → image execution → obverse, reverse, manifest.

The v1 compiler keeps its grammar deliberately small. It is designed to make a photographic composition traceable, not to become a general-purpose graphics program.

## Repository map

| Path | Purpose |
| --- | --- |
| `src/main.rs` | Rust parser, validator, IR lowerer, CLI, and parser tests. |
| `executor/run.py` | Python/Pillow CPU executor, reverse renderers, palette analysis, and manifest writer. |
| `examples/*.robby` | Valid and invalid scripts that exercise v1 language features. |
| `client/` | Static React viewer for a generated composition and its process graph. |

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

## Compile a script

Compile the Rust core once and then lower a script into its JSON IR.

```bash
cargo test
cargo run -- compile examples/night-duality.robby --out output/night-duality.ir.json
```

To validate without writing an IR file, run:

```bash
cargo run -- check examples/night-duality.robby
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

## Known v1 boundaries

Version 1 deliberately excludes a custom mask editor, nested groups, text/vector layers, animation, and GPU acceleration. The target is a small, inspectable compiler pipeline whose artifacts are easy to understand and extend.

## Verification

The current implementation is covered by four Rust parser/validator tests and end-to-end command paths for six valid examples. See [`docs/testing.md`](docs/testing.md) for the core checks, [`docs/gallery-revision.md`](docs/gallery-revision.md) for the gallery interaction contract, and the explicit limitations of the deterministic mask adapters.
