# Gallery interaction contract

Robby’s gallery presents each compiled photograph as a **two-sided image-object**, not as a side-by-side comparison. The central stage renders exactly one image element for the active record. Its source is the obverse artifact by default and becomes the corresponding reverse artifact only after an explicit turn action.

| Interaction | Required visible state | Trace behavior |
| --- | --- | --- |
| Select a gallery record | The selected record opens on its obverse. | The adjacent trace changes to that record’s manifest-derived steps. |
| Turn to inverse | The obverse is replaced by the inverse; it is not displayed elsewhere. | The trace heading and manifest strip change from `obverse` to `inverse`. |
| Return to obverse | The inverse is replaced by the obverse. | The trace heading and manifest strip return to `obverse`. |
| Previous or next | The new record begins on its obverse, even if the old record was inverse-side up. | The adjacent trace swaps to the new record’s compilation record. |

The supplied Ayodhya, urban-fantasy, Murgeshpalya, and Uganda photographs are each compiled as base-image scripts. Their current companion reverse is a calculated eight-colour palette plate; the original night-duality composition retains its provenance-map reverse because it includes a transformed `person` cutout layer.

## Interaction verification

The test browser verified the following sequence. First, `Night duality` showed only its obverse. Activating “Turn to inverse” replaced that image with the provenance-map inverse, changed the stage state to `INVERSE`, changed the trace heading to `Night duality / inverse`, and set the manifest strip to `INVERSE · MUTUALLY EXCLUSIVE`. Selecting the next record then showed `Ayodhya mural` on its **obverse** with its own four-step palette trace.
