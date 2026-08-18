# Sacred artwork stage — verification notes

## 2026-08-18

- The live desktop gallery presents a **690px** fixed artwork viewport for the initial specimen. The active image’s accessible bounding box is `898 × 690`.
- The artwork face contains no visible face-stamp, registration-corner, or full-view control overlays. The four registration marks occupy the neutral outer frame; selected-face information and the full-view action sit in the metadata strip below.
- The compiled gallery still exposes separate **Next image** and **Turn to inverse** controls for testing the two motion paths independently.

The live forward-navigation check replaced Night duality with Ayodhya mural while preserving an identical `898 × 690` artwork viewport and the same neutral metadata/control geometry beneath it. The face-turn button remains available as a separate action after the navigation slide completes.

The subsequent **Turn to inverse** action changed only the active face to Ayodhya mural’s inverse. Its visible image box remained `898 × 690`, demonstrating that the retained face-turn is separate from specimen navigation and does not alter the stable stage geometry.

At a `375px` mobile viewport, the image occupies a fixed `338 × 277` stage box. The metadata, face indication, full-view action, flip control, and gallery navigation remain in distinct surrounding blocks rather than over the image itself.

## Pure-slide refinement

The gallery navigation keyframes now animate only `transform: translateX(...)`: outgoing and incoming specimens travel a full viewport width, with no `opacity` declaration or interpolation. The inner object-turner retains its separate 3D transform transition for face changes.

A refreshed live navigation check advanced from Night duality to Ayodhya mural through the pure-slide path; the successor rendered normally in the fixed stage and the separate flip control remained present for the inverse-only card-turn path.
