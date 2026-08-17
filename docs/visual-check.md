# Visual check — night-duality example

The supplied night-street photograph provides a saturated, low-key base with vivid cobalt, cyan, magenta, green, and rose highlights. The generated obverse visibly demonstrates the executor’s first genuine cutout-and-place pass: the same source photograph, isolated through the `person` strategy, is transformed and composited as a second foreground layer.

The provenance reverse is a high-contrast charcoal field with the declared registration-vermilion layer mask and a restrained coordinate grid. Its silhouette is intentionally broad because the current v1 `person` adapter uses deterministic OpenCV auto-foreground segmentation for opaque photographs. The manifest must therefore keep its `opencv-grabcut-auto-foreground` label prominent instead of implying a semantic-model mask.

These observations establish two viewer rules: the selected layer must display both its provenance colour and its actual mask strategy, and the paired images need enough scale to be read as co-equal photographic objects.
