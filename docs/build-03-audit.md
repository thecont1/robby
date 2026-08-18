# Build 03 audit — signature evidence and flip behavior

## Credential evidence

The five local **original source assets** were scanned for `c2pa` and `jumb` byte markers, the standard identifiers expected for an embedded C2PA/JUMBF credential container. No marker was found in any source asset. Therefore every specimen is represented as **`C2PA ABSENT`**, not `C2PA VERIFIED`.

This is a real local source-byte result, not placeholder content. It does **not** establish cryptographic validation; a marker scan can reliably support an absence state in this local set, but a full C2PA validator is required before showing `C2PA VERIFIED`, issuer, edit history, or capture assertions for a signed asset.

| Specimen | Source-byte result | Issuer / history / capture | Evidence |
| --- | --- | --- | --- |
| Night duality | C2PA absent | No embedded record available | SHA-256 source record + marker scan |
| Ayodhya mural | C2PA absent | No embedded record available | SHA-256 source record + marker scan |
| Urban fantasy | C2PA absent | No embedded record available | SHA-256 source record + marker scan |
| Murgeshpalya passage | C2PA absent | No embedded record available | SHA-256 source record + marker scan |
| Uganda diptych | C2PA absent | No embedded record available | SHA-256 source record + marker scan |

The complete asset-hash, pixel-hash, palette-hash, and palette data is checked into [`build-03-signatures.json`](build-03-signatures.json). `scripts/derive_signatures.py` regenerates this record from the original source assets and the compiled obverse files.

## Colour evidence

Each colour signature is real pixel-derived data from the active **compiled obverse**. The signature includes a SHA-256 fingerprint of raw RGB pixels, a SHA-256 fingerprint of the eight-colour palette, and the deterministic eight-colour palette calculated by the existing `robby-executor-v1` k-means routine. It is human-readable in the viewer but it is not a cryptographic authenticity claim.

## Flip audit

The previous component swapped a single image source at the same time that it applied a keyframe rotation to its container. It did not use a timeout, but it also did not maintain preloaded obverse and inverse faces or 3D backface rules. This made the flip vulnerable to showing a changed payload at the wrong visual phase.

The Build 03 repair uses one declarative state machine: `face` (`obverse` or `inverse`) and `isFlipping`. The two image faces remain mounted and preloaded inside one 3D object. Clicking locks input, changes `face` once, and CSS derives the rotation from that face. `transitionend` unlocks input. No midpoint timeout, payload rewrite, or global/default reverse selection participates in the turn.

The two preloaded face elements are also mutually exclusive in the accessibility tree. The inactive face carries `aria-hidden`, ensuring that screen-reader output follows the same one-visible-face contract as the visual object.

## Live verification

The live gallery exposed the active specimen’s `C2PA ABSENT` badge, `COLOUR SIGNATURE` swatches, and both `credential_signature` and `colour_signature` trace fields. A complete `Night duality` turn then reached `INVERSE`, showed the provenance-map inverse payload, changed the trace heading to `Night duality / inverse`, relabeled the control `Return to obverse`, and left the inactive obverse image out of the accessibility tree. No delayed fallback matrix or global reverse payload appeared.

After cycling to `Ayodhya mural`, the gallery reset to its obverse and updated the trace to `C2PA ABSENT · 7b97c159e3eb…`, `px:78ee78cb60c8… · pal:83c583bdaa06…`, and `reverse_mode: palette-grid`. This confirms the signature layer is scoped to the selected specimen rather than global state.
