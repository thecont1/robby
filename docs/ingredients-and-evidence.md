# Ingredients and embedded evidence

## Current v1 boundary

Robby still produces **one reverse artwork per obverse**. The optional **Visual ingredients** and **Embedded evidence** views do not create additional reverse images, write files, or alter the authored recipe. They are explainability surfaces around the same troid compilation pipeline.

The analysis is triggered explicitly from Teppanyaki Counter. It reads the exact immutable source bytes through the existing browser Rust/WASM bridge and returns a bounded `robby-ingredients-v1` record. The current record contains source and pixel hashes, dimensions, orientation, colour-profile presence, median-cut palette entries and shares, a perceptual average hash, luminance bands, an 8 × 8 spatial palette field, an edge-contrast field, a local texture field, and privacy-safe metadata/C2PA extraction states.

The analysis is intentionally bounded. It does not transfer a full raster into React state, persist a derivative, expose raw GPS coordinates, or publish EXIF/IPTC/XMP values. A GPS state may be `present`, but the coordinate itself remains private. When GPS is present, Rust derives a coarse seed and a bounded height field; the **Embedded evidence** view requires a separate user click before rendering that generalized terrain surface with Three.js. The terrain is an evidence visualization, not a second reverse artwork.

## How the three counter views relate

| View | Trigger | Output | Privacy boundary |
|---|---|---|---|
| **Counter** | Existing compilation actions | Eight live compiler stations and the one reverse result | Existing public-safe trace and transient output rules |
| **Visual ingredients** | `Analyze ingredients` | Palette, hashes, luminance, spatial, edge, texture, and perceptual fields | Measurements only; no image derivative |
| **Embedded evidence** | `Inspect evidence` | EXIF, IPTC, XMP, GPS, and C2PA extraction states | Raw values withheld; GPS coordinates never displayed |
| **Generalized terrain** | `Show generalized terrain` after GPS evidence inspection | Coarse region-derived Three.js surface | Explicit consent; only a bounded height field crosses the Rust/WASM boundary |

## Proposed language direction: v2, not silently enabled in v1

The richer object-oriented language is implemented as versioned `robby-ir-v2` recipe syntax. It is available independently from the v1 line-oriented syntax through `troid recipe-check` and `troid recipe-compile`.

```text
object "bangalore-night-001" {
  input "MS202308-Bangalore0739-Enhanced-NR.jpg"

  evidence {
    exif: "read"
    iptc: "read"
    xmp: "read"
    c2pa: "verify"
    gps: "private"
  }

  split palette {
    method: "median-cut"
    colours: 12
    order: "frequency"
  }

  measure {
    luminance: true
    texture: "grid"
    grid: 24
  }

  bind {
    source: "sha256"
    pixels: "canonical-rgba-sha256"
    evidence: "verified-public"
    recipe: "canonical-ir"
  }

  reverse "palette-grid" {
    cell: 10
    arrange: "seeded-shuffle"
    seed: "object-binding"
    border: "source-palette"
  }

  publish {
    gps: "remove"
    c2pa: "summary"
    manifest: "public-safe"
  }
}
```

The intended compiler architecture is:

```text
source language
    → parse and validate
    → object IR
    → intake/evidence pass
    → measure pass
    → bind reproducibility record
    → exactly one reverse module
    → public-safe manifest
```

The crucial invariant remains: **analysis may become an explicit, inspectable compiler input, but it must not become an implicit semantic interpretation of what the photograph depicts.**

## CLI examples

```sh
troid recipe-check gallery/example.robby
troid recipe-compile gallery/example.robby --out /tmp/example-ir.json
```

The older commands remain available for the v1 language:

```sh
troid check gallery/example-v1.robby
troid compile gallery/example-v1.robby --out /tmp/example-v1-ir.json
```
