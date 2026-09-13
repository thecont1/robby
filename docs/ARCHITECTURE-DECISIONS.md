# Robby architecture decisions

This is the accepted decision log for the active one-image compiler. Historical proposals may be mentioned for context, but they do not override accepted decisions or the code contract.

## ADR-001: single obverse -> reverse image-object

- Status: accepted
- Date: 2026-09-13
- Scope: product definition, compiler input model, viewer relationship, and future phase design

### Decision

Robby receives one source photograph as the obverse and compiles one deterministic companion reverse. Together they form a two-sided image-object. The viewer presents exactly one face at a time: `OBVERSE` or `REVERSE`.

The reverse is a distinct image generated from the obverse's exact bytes, decoded RGB material, explicit recipe/settings, and the active compiler/renderer contract. In the currently shipped v1 implementation, that recipe is the ordered `base` / optional `palette` / `reverse(mode: "negative")` / transient `output` DSL.

### Why

The artistic and technical proposition is image-object duality: the visible photograph and its computational reverse are related but mutually exclusive faces. A single source keeps the compiler explainable, deterministic, and auditable. It also preserves the existing gallery as a collection of source photographs without turning Robby into a general image-editing system.

### Consequences

- Exactly one image input is active for a compilation run.
- Multi-image compositing, collage, overlay placement, masks, semantic cutouts, and segmentation are out of scope.
- The gallery may contain many source photographs for navigation and comparison; that does not make a compile run multi-image.
- The obverse remains the primary source face and is never rewritten.
- Reverse output is generated on demand and remains transient in v1.
- Any future richer stage model must still resolve to one obverse and one reverse object.
- Historical rejection fixtures for removed multi-source or semantic syntax are retained as evidence of the boundary.

### Alternatives rejected

1. Multi-image composition as the core model — rejected because it changes Robby into an editor/compositor and obscures the source-to-reverse relationship.
2. Semantic masks or cutouts — rejected because Robby must not infer depicted subjects or regions.
3. Static pre-generated reverse catalogue assets — rejected because the live proposition is truthful, fresh compilation from current source and recipe.
4. Showing both faces as a composite canvas — rejected because the object relationship depends on mutually exclusive visibility.

### Verification

The current implementation and tests establish the v1 subset: one `base`, deterministic RGB analysis, one registered `negative` reverse module, transient output targets, no-store responses, native/WASM parity, and no durable reverse assets. See [`BASELINE.md`](./BASELINE.md) and [`EVIDENCE-TAXONOMY.md`](./EVIDENCE-TAXONOMY.md).

## ADR-002: deterministic transient v1 output

- Status: accepted
- Date: 2026-09-13

Robby's current v1 renderer must produce byte-identical output for identical source bytes and canonical settings, while returning reverse PNG bytes and the render manifest as transient response data. No final reverse PNG, durable reverse URL, or persisted runtime manifest is a source of truth. Binding, richer evidence selection, and expanded event stages belong to later phases and must preserve this determinism boundary.

## ADR-003: deterministic median-cut palette and reverse modes

- Status: accepted
- Date: 2026-09-13
- Scope: Phase 4 visual split, reverse renderers, and artifact descriptors

### Decision

Robby extracts a palette with a portable, fully specified median-cut algorithm. No k-means, no SIMD colour conversion, and no unseeded randomness.

Median-cut contract:

1. Decode source bytes to 8-bit RGB with the existing scalar JPEG path and the `image` crate for other accepted formats.
2. Start with one box containing every RGB sample in raster order.
3. Repeatedly split the box with the largest channel range, then pixel count, then oldest ordinal, until `k` boxes exist or no box has more than one pixel.
4. Split on the widest channel; ties prefer R, then G, then B. Sort that box by `(channel, r, g, b)` and cut at `len / 2`.
5. Each box becomes a palette entry whose RGB is the integer mean of its pixels and whose weight is the pixel count.
6. Order entries by descending weight, then ascending RGB. Rank is that order, starting at zero.

This palette, the nearest-colour index map (ties prefer the lower rank), and the recipe settings are the only visual materials for reverse generation.

Supported reverse modules:

- `quantised_obverse`: map each output pixel to its source sample's nearest palette colour. Default size is the decoded source size. Dither is none.
- `palette_grid`: fill a cell grid with tiles allocated by palette weights, then Fisher–Yates shuffle using only the derived render seed. Default size is the decoded source size; default cell is 10.
- `negative`: retained v1 backend for existing scripts.

Apparent randomness in `palette_grid` comes only from `RenderSettings.seed` (and the rest of the hashed settings) plus source bytes. Changing seed rearranges tiles; it does not recompute the palette.

Each reverse PNG is described by an artifact descriptor (`media_type`, `width`, `height`, `sha256`). The palette index map is recorded by SHA-256 of the packed nearest-colour indices. Repeating a render is byte-identical.

### Why

A single documented algorithm is required for native/WASM parity. Median-cut is stable, integer-only, and independent of iteration order tricks that make naive k-means platform-sensitive.

### Consequences

- Palette method is always `median_cut` with `ordering: frequency_desc_then_rgb_asc`.
- Semantic vision, masks, multi-image composition, and reserved future reverse modes remain unimplemented.
- Manifests keep `robby-render-manifest-v1` identity fields and add explicit palette, parameters, index-map hash, and artifact descriptors.
