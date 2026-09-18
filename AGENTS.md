# Robby — project rules

- **Reverse dimensions are sacred**: the compiled reverse must always keep the
  obverse's exact pixel dimensions. Never rescale, crop, or letterbox the
  reverse relative to the source. Do not use `RenderSettings.width/height`
  overrides to diverge from source size for reverse outputs.
  (`quantised_obverse` is already source-sized — keep it that way.)
