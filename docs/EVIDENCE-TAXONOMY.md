# Robby evidence taxonomy

Robby labels records by how they entered the system. Do not collapse these classes into a generic “metadata” or “provenance” label. A classification describes the record's epistemic status; it does not assert that the underlying claim is true.

| Class | Meaning | Typical source | Example |
|---|---|---|---|
| `observed` | Read directly from the source file or its embedded fields. It may be absent, stale, incomplete, or user-authored. | JPEG/container, EXIF, IPTC, XMP | Camera model present in EXIF |
| `verified` | Checked by a named cryptographic, standards-aware, or other explicit validation process. The scope and method must be shown. | C2PA SDK validation | C2PA manifest with reported valid state |
| `measured` | Calculated by Robby from source bytes or decoded pixels using a documented algorithm. | Intake and analysis code | Byte SHA-256, dimensions, luminance statistics |
| `derived` | Produced by a Robby algorithm from measured/observed inputs. | Compiler or renderer | Palette swatches, seed, quantised raster |
| `declared` | Supplied explicitly by the recipe author or user, including context overrides and publication policy. | `.robby` source or UI control | A declared setting or `k` value |
| `redacted` | Known to exist or retained in an internal record but intentionally omitted from the displayed/exported view. | Privacy/publish policy | GPS value withheld from public output |
| `unavailable` | Not found, unsupported, unreadable, invalid, or intentionally absent for this run. | Extractor/validator result | No XMP block, unsupported C2PA reader |

## Rules

1. Every displayed evidence field has one primary class. If a value has multiple histories, retain those histories as separate records rather than overwriting the class.
2. `observed` is not `verified`: embedded author or camera fields are observations, not proof of authorship, location, time, or truth.
3. `verified` is scoped: display the method and validation state. C2PA validation does not establish ownership, authorship, ethics, or editorial accuracy.
4. `measured` and `derived` are not source claims. They are reproducible results of Robby's algorithms and must carry their algorithm/parameter contract where relevant.
5. `declared` must remain visibly distinct from observed source evidence. A declared place/time/era can guide a future reverse without silently rewriting the source record.
6. `redacted` is not the same as `unavailable`: redaction means the value is intentionally withheld; unavailable means Robby cannot usefully report it.
7. Missing evidence is valid input. A sparse or stripped JPEG must still be compilable from its available bytes, pixels, and recipe.
8. Raw GPS, device identifiers, precise capture time, creator contact fields, and other sensitive values default to private in public-facing views.

## Current v1 mapping

The shipped v1 renderer predates the richer intake/evidence pipeline planned for later phases. Its active manifest is intentionally narrow:

- source byte SHA-256: `measured`
- RGB swatches and their ordering: `derived` from measured pixels
- script/settings SHA-256 and render seed: `derived`
- render module name: `declared` (the registered module selected by the recipe); output SHA-256: `measured`
- C2PA embedded fields: `observed`; a successful SDK validation result: `verified` with its method and scope; an absent or unsupported credential: `unavailable`
- missing optional material: `unavailable`, not an error by itself

The client exports the lower-case `EpistemicClass` union and runtime `isEpistemicClass` guard from `client/src/lib/evidence.ts`. Public display labels may be title-cased (`Observed`, `Verified`, and so on) without changing the wire vocabulary.
