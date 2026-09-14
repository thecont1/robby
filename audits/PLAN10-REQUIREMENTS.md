# Plan 10 requirement matrix

Re-derived from the Phase 10 brief, not from the carried task list. Evidence paths are relative to the repository root.

## Product and authority contract

| Requirement / edge case | Implementation evidence | Verification |
|---|---|---|
| Gallery selection never compiles automatically | `Home.tsx` starts only from `compileOrio`; selection discards active reverse | lifecycle Vitest; browser pre-run shows 0 stations and disabled Turn |
| Compilation begins only by explicit request; run is identifiable | `compileController.ts`, `compileEvents.ts` | latest-run/cancellation tests; browser happy path |
| Exact source bytes feed intake and C2PA | server source-byte snapshot boundary; C2PA POST accepts intake bytes + digest | `server/c2pa.test.ts`, `server/liveRender*.test.ts` |
| Source, canonical pixels, authored/canonical recipe, policy, binding, output and run remain distinct | typed artifacts/events and separate UI labels | controller, identity, parity, browser happy-path evidence |
| Browser does not duplicate Rust intake/binding algorithms | WASM adapters call Rust exports | native/WASM parity suite |
| `robby-ir-v1` remains public wire version | compiler adapters and tests | compiler/IR tests |

## State truth table

| Lifecycle state | Required UI truth | Verification |
|---|---|---|
| Selected, no run | C2PA `NOT INSPECTED`; pixels `NOT MEASURED`; binding `NOT FORMED`; reverse `NOT REQUESTED` | `demoData.test.ts`; real pre-run DOM |
| Running | C2PA inspecting, pixels measuring, binding/reverse pending; real events only | compile controller + counter tests |
| Read/Measure/Bind/Resolve | completed facts persist while later stages remain pending | controller/event tests; browser station audit |
| Marry | final run-bound record and ready reverse | browser happy path completes all 8 stations |
| Recipe/source/policy/runtime changes | historical result becomes stale, never current | compile action/controller/history tests |
| Cancel/fail | preserve completed evidence, never fabricate later facts/Ready | cancellation/failure tests |
| Navigation and rapid repeat | only current run/current selected source can update UI; latest same-source run wins | controller race tests |

## Intake and binding acceptance

| Requirement | Verification |
|---|---|
| Same bytes → same canonical pixels | intake/native-WASM tests |
| Recipe-only change does not change pixel identity | intake/binding tests |
| Source-byte change invalidates or changes run | source boundary/controller tests |
| Sparse image still receives canonical pixel identity | `tests/fixtures/render-source.jpg` parity/render tests |
| Same complete binding inputs → same digest | Rust binding + parity tests |
| Recipe/policy/runtime/evidence changes alter binding as prescribed | binding/controller tests |
| Binding cannot cross selected image/run | controller stale guards |
| Binding copy avoids ownership/authenticity claims | counter copy regression |

## Sacred source and output boundary

| Requirement | Verification |
|---|---|
| Never modify/re-encode source; C2PA reads original bytes | source hash/name before-after tests |
| No PNG/JSON/sidecars/temp output beside source | `server/liveRender.local.test.ts`, gallery watcher tests |
| Reverse has separate output identity and no inherited source credential | render/controller/C2PA tests |
| Reverse URLs are ephemeral and cleaned on replacement/unmount | browser/controller URL lifecycle tests |
| No archive/cloud/persistence scope creep | source scan + architecture tests |

## Development reverse

| Requirement | Verification |
|---|---|
| Deterministic pixels for identical complete input | `server/liveRender.local.test.ts` |
| Input change changes output | k=8 vs k=20 determinism regression |
| Palette/swatch hierarchy remains legible through k=64 | Rust phase-4 render tests; native/WASM parity |
| Only policy-renderable evidence appears | disclosure audit + observability sheet tests |
| No GPS, exact timestamps, filenames, contacts, serials, full C2PA, raw dumps or source thumbnails by default | disclosure tests |
| Visible blocks trace to manifest sources | manifest/render tests |
| Never claim guaranteed anonymity/privacy | disclosure-copy tests |

## Finish plan §13

| Requirement | Current proof |
|---|---|
| Obverse remains primary; recipe visibly below it; counter activates on deliberate compile | real DOM at 1280/390/360 |
| Pre-success hierarchy: Compile → Validate → Reset | policy tests + DOM order |
| Post-success hierarchy: Turn → Recompile → Inspect | policy tests + browser happy path |
| Dormant counter is one instruction, no 8 empty stations | counter presentation test + real DOM station count 0 |
| Running counter shows actual station artifacts | browser happy path |
| Completed counter is collapsed but expandable | semantic `<details>` + browser happy path |
| No fake timing/typewriter effects | event-backed station model |
| Draft preserved exactly; diagnostics textual and line-associated | recipe-authority/editor tests |
| Narrow order: obverse/actions → workbench → counter → provenance | real DOM at 390 and 360 |
| Skip link, gallery/editor shortcut isolation, tablists, modal trap/Escape/restoration | CDP interaction audit |
| Landmarks/headings/name/state/live regions/range semantics | DOM audit + Chrome AX tree |
| 44×44 targets, zero 360px page overflow, zoom available, no hover-only critical control | computed DOM audit |
| Light and dark contrast; reduced motion | composited contrast + emulated media audits |
| Desktop/mobile Lighthouse package | must be regenerated against production server, not Vite/empty shell |

## Fixture matrix

| Fixture class | Local representative / boundary |
|---|---|
| C2PA-bearing, v2 claim | `IMG_20200218_095220.jpg` — real embedded JUMBF manifest `urn:c2pa:6db0e6cd…:adobe`, `c2pa.claim.v2`, Lightroom Classic 15.5 / c2pa-rs 0.85.0. UI run: `PRESENT · VALID · UNTRUSTED SIGNER · GPS PRIVATE`. Verified against file bytes with exiftool. |
| C2PA-bearing, v1 claim | `MS202401-Ayodhya0041.jpg` — distinct manifest `urn:uuid:ce247ac2…`, legacy `c2pa.claim`, Lightroom Classic 15.2.1 / c2pa-rs 0.46.0. Same UI verdict, independently derived (distinct source/pixel/binding/output hashes). Exercises the older spec generation through the same reader. |
| Stripped/sparse | `tests/fixtures/render-source.jpg` — no JUMBF; canonical intake/render, source-integrity, deterministic k=20/64 and native/WASM parity coverage |

Correction to an earlier working assumption: both gallery specimens are C2PA-bearing. An
earlier note claiming only one carried a credential was wrong — `exiftool -G1` confirms
independent manifests in both. Identical `VALID · UNTRUSTED SIGNER` status is the correct
verdict, not leaked state: both are Adobe-signed and Adobe's cert is outside the local
trust list. No trusted-signer fixture exists locally, so trusted-path semantics remain
covered only by server reader-summary tests.

## Honest limitations

- No trusted-signer C2PA fixture is present locally. The local embedded credential is valid but untrusted; do not report it as trusted.
- Browserbase cannot reach this local server. Browser evidence is produced by local headless Chrome over CDP.
- Earlier Lighthouse reports that saw `No images in gallery/ folder` are invalid and must not be used.
