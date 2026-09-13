# Robby baseline

Status: verified 2026-09-13
Repository: `/Users/home/DEV/tools/robby`
Baseline commit before this documentation pass: `6b06da4`

This document records the implementation that exists today. It is a snapshot for the next phases, not a promise that every item below is the final product contract.

## Product and runtime contract

Robby currently compiles one gallery JPEG into a transient reverse PNG. The source photograph is the obverse; the reverse is generated only when the viewer requests a turn. The primary compiler contract is intentionally opaque-input: the Rust renderer uses exact source bytes, decoded RGB values, flat colour statistics, and explicit settings, but does not interpret depicted subjects or regions. Structural metadata and C2PA inspection are separate application-layer evidence services, not renderer inputs.

The active v1 DSL is ordered and deliberately small:

```text
base("source.jpg", width: 1024, height: 768)
palette(k: 8)
reverse(mode: "negative")
output(obverse: "source.jpg", reverse: "transient", manifest: "transient")
```

There are four supported reverse modules (`negative`, `observability_sheet`, `quantised_obverse`, and `palette_grid`). Reverse PNG bytes and the render manifest are response data, not durable gallery assets.

## Architecture that is verified in code

```text
React gallery and source editor
  -> Rust/WASM compile(source)
  -> robby-ir-v1 JSON
  -> POST /api/reverse
  -> native Rust renderer
  -> image/png + reproducibility headers
  -> in-memory object face and trace
```

### Compiler core

- `src/lexer.rs`, `src/parser.rs`, `src/ast.rs`: lex, parse, and build the source AST.
- `src/validator.rs`: enforce command order, one `base`, bounded `palette(k)`, one `reverse`, supported mode, and transient output targets.
- `src/ir.rs`: lower validated source to `robby-ir-v1`.
- `src/render.rs`: deterministic RGB clustering and the registered `negative`, `observability_sheet`, `quantised_obverse`, and `palette_grid` renderers; final PNG encoding is delegated to the pinned Rust `image` crate.
- `src/main.rs`: native CLI boundary.
- `src/lib.rs`: library and WASM-facing compile/render exports.

### Browser and server

- `client/src/wasm/`: generated WASM compiler bindings used by `client/src/lib/robbyCompiler.ts`.
- `client/src/pages/Home.tsx`: gallery, one-face-at-a-time viewer, source editor, live turn action, and trace projection.
- `client/src/lib/liveRender.ts`: submits canonical IR and validates the transient response manifest/headers.
- `server/liveRender.ts`: HTTP reverse endpoint boundary and native-render invocation.
- `server/liveRenderer.ts`: defensive `robby-ir-v1` validation before native rendering.
- `server/galleryWatcher.ts`: scans the configured gallery root, reads or creates adjacent `.robby` scripts, and exposes JPEG catalogue records.
- `server/gallerySource.ts`: flat filename, regular-file, symlink, and realpath containment boundary.
- `server/c2pa.ts`: exact-local-JPEG C2PA inspection through the official SDK, with scoped status (`absent`, `candidate`, `present`).

The ordinary static server in `server/index.ts` serves the built client. The application server entry used by the active development/deployment path is `server/_core/index.ts`, which registers the gallery, C2PA, reverse, and static routes.

## Preserved data shapes and APIs

### `robby-ir-v1`

```ts
{
  version: "robby-ir-v1",
  canvas: { base: string, width: number | null, height: number | null },
  palette: { k: number },
  reverse: { mode: "negative" },
  output: { obverse: string, reverse: string, manifest: string },
  meta: { script_sha256: string }
}
```

`output.reverse` and `output.manifest` must both be `"transient"` at the live-render boundary.

### Transient render manifest

The native endpoint returns PNG bytes with the `robby-render-manifest-v1` values surfaced in response headers and client runtime state:

- `source_obverse_sha256`
- `script_settings_sha256`
- `derived_seed`
- `output_sha256`
- `render_module`
- ordered `colour_swatches`
- `cached_intermediate` (currently `null`)

The client also records an in-memory runtime record (`compiledAt`, IR hash, toolchain, and transient reverse details) and releases the object URL when the reverse is discarded.

### Gallery record

Static and watched gallery records expose source identity and display data, including `id`, `source`, `dimensions`, `obverse`, `reverse` (currently empty), `reverseMode`, `script`, `trace`, C2PA credential status, and colour signatures. A reverse URL is never a catalogue asset: the current in-memory compiler response is the only active reverse face.

### Relevant HTTP boundaries

- `GET /gallery/:flat-jpeg-name`: serves only an allowlisted direct JPEG file.
- `GET /api/gallery`: returns the current catalogue.
- `GET /api/c2pa/:source`: inspects the exact local JPEG bytes.
- `POST /api/reverse`: accepts Rust-validated canonical IR and returns a no-store transient PNG plus reproducibility headers.
- `GET /api/gallery/events`: server-sent gallery update notifications.

Exact route registration and error handling are covered by the server contract tests; use the implementation as the source of truth when adding routes.

## Deprecated or deliberately absent components

The following are not active implementation paths and must not be reintroduced through compatibility prose:

- semantic image understanding, captions, object/face detection, segmentation, masks, cutouts, or region-aware compositing;
- multi-image input or collage/overlay placement;
- the retired Python image executor and remote platform/auth/storage/database stack;
- durable reverse PNGs, durable reverse URLs, persisted runtime manifests, or final-output caches;
- local signing/export as an authority or ownership system;
- arbitrary reverse modules beyond the four registered modes (`negative`, `observability_sheet`, `quantised_obverse`, `palette_grid`);
- generalized arbitrary-JPEG upload/viewer workflows.

Old syntax and removed concepts remain in rejection fixtures where needed to prove that retired contracts stay rejected. Those fixtures are historical test inputs, not supported product capabilities.

## Risks and open edges

1. The current runtime is a four-stage compiler (`base`, `palette`, `reverse`, `output`), while the next execution plan proposes richer intake, evidence, measurement, split, declaration, binding, resolve, and marry stages. Do not describe proposed stages as implemented until code and tests land.
2. Gallery selection currently resets the active face and discards the prior transient reverse. The plan's explicit `compileRunId`, event cancellation, and stale-event isolation are future work.
3. Current gallery metadata exposes C2PA status separately from the render manifest. It must remain scoped validation evidence, never generic provenance or ownership.
4. The palette implementation is deterministic and parity-tested for native/WASM in the current suite, but any new analysis must preserve a single canonical algorithm and exact byte parity.
5. `.robby` sidecars are generated beside gallery images when absent. This is source configuration, not a reverse-artifact store; future intake work must preserve that boundary.
6. The current UI uses historical terms such as `inverse` in some internal identifiers and fixtures. User-facing contract language should prefer `reverse`; renaming internals can be a later compatibility-conscious change.
7. Shared-directory Kanban work means later phase workers must inspect the current tree and parent commits before editing overlapping files.

## Baseline commands and results

Commands were run from the repository root before this documentation pass:

| Command | Result |
|---|---|
| `pnpm test -- --run` | 22 files, 86 tests passed |
| `cargo test --all-targets` | 10 unit + 7 render determinism + 4 spec-contract tests passed |
| `pnpm check` | TypeScript completed with exit code 0 |
| `cargo fmt --check && cargo check --all-targets` | completed with exit code 0 |

The parity suite is included in the Vitest run (`server/nativeWasmParity.test.ts`, 5 cases). The existing rejection fixtures in `tests/spec_contract.rs` intentionally remain part of the baseline.

## Change policy for the next phases

Preserve the one-obverse -> reverse image-object contract, transient output boundary, deterministic native/WASM behavior, and rejection fixtures. Any extension must add a focused failing test first, then the smallest implementation, and must update this baseline when the verified architecture changes.
