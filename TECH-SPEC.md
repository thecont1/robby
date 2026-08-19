# robby technical specification

Version: v0.1 (living document)
Status: **Constitutional purge and deterministic live-render parity verified.**

---

## 1. System definition

`robby` is a small compiler. A `.robby` source file is lexed, parsed, validated, lowered to the versioned `robby-ir-v1` JSON intermediate representation, and used to generate a transient raster reverse plus a reproducibility manifest.

Its correctness properties are:

- one Rust implementation of lexing, parsing, validation, IR lowering, and rendering;
- explicit, inspectable compiler stages;
- deterministic results from exact source bytes and canonical settings;
- no semantic interpretation of depicted content;
- no persisted reverse image.

The generated PNG is a compiler target consumed by ordinary raster decoders. The current code generator delegates final PNG encoding to the pinned Rust `image` crate rather than hand-emitting PNG chunks.

## 2. Architecture

```text
.robby source
  → Rust lexer / parser
  → AST
  → Rust validator
  → robby-ir-v1
  → registered Rust render module
      inputs: exact obverse bytes, RGB values, canonical settings
      output: transient PNG bytes + robby-render-manifest-v1
```

The Rust library is compiled to two public targets:

- browser WASM for source compilation and target-parity verification;
- native CLI (`robby compile …`, `robby render …`) used by the HTTP server.

The React client does not reimplement the compiler. It compiles source through WASM, sends canonical IR to the local HTTP boundary, and displays the transient native result.

## 3. Current DSL

Commands must appear in this order:

```text
base("source.jpg", width: 1024, height: 768)
palette(k: 8)
reverse(mode: "negative")
output(obverse: "source.jpg", reverse: "transient", manifest: "transient")
```

| Command                              | Contract                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `base(path, width?, height?)`        | Declares exactly one gallery JPEG and optional output dimensions.           |
| `palette(k)`                         | Optional; selects 3–16 deterministic RGB clusters. Omission means `k = 8`.  |
| `reverse(mode: "negative")`          | Required exactly once; selects the only v1 render module.                   |
| `output(obverse, reverse, manifest)` | Required final command; reverse and manifest targets must be `"transient"`. |

Unknown commands, fields, output targets, duplicate declarations, non-integer `k`, out-of-range `k`, and modes other than `negative` are compile errors. Removed syntax is not accepted through compatibility translation.

## 4. Constitutional rule

> The compiler must never understand, interpret, classify, or otherwise derive meaning from what the obverse depicts.

The obverse may be treated only as:

1. exact raw bytes, for identity and integrity hashing;
2. an RGB matrix, for flat numerical colour statistics;
3. structural file metadata, such as dimensions, format, and embedded C2PA credentials.

No spatial content model, depicted-subject model, captioning, recognition, or inferred region metadata belongs in this pipeline. This is a constitutional boundary, not an optimization preference.

## 5. Deterministic reverse generation

```text
source_hash   = sha256(exact_obverse_bytes)
settings_hash = sha256(canonical_render_settings)
derived_seed  = sha256(source_hash || settings_hash)
swatches      = deterministic_rgb_clustering(decoded_pixels, k)
reverse_png   = registered_module(swatches, settings, seeded_stream)
```

`derived_seed` is a reproducibility mechanism, not an encryption key. The module registry currently contains exactly `negative`. The module inverts the flat swatches and arranges them procedurally using only canonical settings and the deterministic stream.

Required guarantees:

- identical source bytes and settings produce byte-identical PNGs and identical manifests;
- source-byte or setting changes alter the seed and output;
- no unseeded randomness exists in clustering or rendering;
- native and WASM targets produce identical PNG bytes and manifest values;
- invalid source bytes, settings, dimensions, or module names fail explicitly.

## 6. Live compilation and persistence

An obverse-to-reverse turn always starts a new render request. A reverse-to-obverse turn performs no render work. A fresh success is required before the UI reveals the reverse; loading and error state remain visible.

The HTTP result is an `image/png` body with reproducibility data in response headers and `Cache-Control: no-store`. The manifest describes that runtime result and is returned to the client; it is not persisted as a reverse-side artifact.

Durable project inputs are the `.robby` source and original JPEG. The following are forbidden:

- writing final reverse PNGs to the repository, gallery, object storage, database, or cache;
- durable reverse URLs;
- returning a prior reverse in place of a fresh compilation;
- durable runtime manifests that imply a reverse is canonical ground truth.

The manifest field `cached_intermediate` is `null` in v1. If intermediate caching is introduced later, it must be explicit and may never cache final reverse pixels.

## 7. Manifest

`robby-render-manifest-v1` contains:

- `source_obverse_sha256`;
- `script_settings_sha256`;
- `derived_seed`;
- `output_sha256`;
- `render_module`;
- ordered `colour_swatches`;
- `cached_intermediate`.

Compile timestamps are runtime events and are deliberately excluded from the deterministic manifest. Embedded C2PA inspection is a separate source-credential concern and is never conflated with the generated render manifest.

## 8. Gallery boundary

`ROBBY_GALLERY_DIR` selects the one gallery root used by catalogue scanning, static JPEG serving, C2PA inspection, and rendering. The boundary:

- accepts only direct `.jpg`/`.jpeg` files;
- rejects traversal, separators, non-regular files, and symbolic links;
- isolates malformed optional sidecars to their own specimen;
- returns an empty catalogue for a missing or empty root;
- reads JPEG dimensions from headers without precomputing render evidence.

## 9. Purge status and verification

The retired semantic executor, Python image stack, persisted reverse paths, local signing/export feature, remote platform auth/storage/database stack, and stale generated WASM bindings have been removed. Rejection tests intentionally retain removed tokens as fixtures so that old contracts cannot return silently.

Completion gates are:

- Rust formatting, build, Clippy, and tests;
- TypeScript static check, Vitest, and production build;
- regenerated pinned WASM bindings;
- native/WASM byte and manifest parity across representative `k` values including both bounds;
- runtime gallery, source JPEG, removed-route, request-limit, and reverse-response checks;
- filesystem before/after proof that rendering writes no artifacts.

MCP, WebMCP, and a generalized arbitrary-JPEG viewer remain out of scope for this work order.
