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
