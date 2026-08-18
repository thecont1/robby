/** The versioned Robby v0.1 command reference mirrors `src/validator.rs`. */

export type ReferenceParameter = {
  name: string;
  type: string;
  required: boolean;
  detail: string;
};

export type ReferenceCommand = {
  name: string;
  syntax: string;
  description: string;
  parameters: ReferenceParameter[];
  example: string;
  notes?: string;
};

export const minimalExample = `base("source.jpg")
palette(k: 8)
reverse(mode: "palette-grid", k: 8)
output(obverse: "obverse.png", reverse: "reverse.png", manifest: "manifest.json")`;

export const languageReference: readonly ReferenceCommand[] = [
  {
    name: "base",
    syntax: 'base(path: string, width?: integer, height?: integer)',
    description: "Declares the one source image that anchors a composition. It must be the first command.",
    parameters: [
      { name: "path", type: "string", required: true, detail: "Positional image path." },
      { name: "width", type: "positive integer", required: false, detail: "Optional canvas width; omit to retain the source dimensions." },
      { name: "height", type: "positive integer", required: false, detail: "Optional canvas height; omit to retain the source dimensions." },
    ],
    example: 'base("night-street.jpg", width: 1440, height: 1080)',
    notes: "Exactly one base command is allowed.",
  },
  {
    name: "cutout",
    syntax: 'cutout(source: string, mask: "person" | "sky", id: string)',
    description: "Registers an auto-masked image layer that can later be placed over the base.",
    parameters: [
      { name: "source", type: "string", required: true, detail: "Image path for the extracted subject." },
      { name: "mask", type: '"person" | "sky"', required: true, detail: "v0.1 supports only the two listed automatic mask kinds." },
      { name: "id", type: "string", required: true, detail: "Unique handle referenced by place(...)." },
    ],
    example: 'cutout(source: "courier.png", mask: "person", id: "courier")',
  },
  {
    name: "place",
    syntax: 'place(cutout: string, x: float, y: float, scale?: float, rotation?: float, opacity?: float, blend?: string)',
    description: "Places a previously declared cutout on normalized base-image coordinates.",
    parameters: [
      { name: "cutout", type: "string", required: true, detail: "A cutout id already declared above." },
      { name: "x / y", type: "float", required: true, detail: "Normalized coordinates from 0.0 to 1.0." },
      { name: "scale", type: "float", required: false, detail: "Greater than 0; default 1.0." },
      { name: "rotation", type: "float", required: false, detail: "Degrees; default 0.0." },
      { name: "opacity", type: "float", required: false, detail: "0.0 to 1.0; default 1.0." },
      { name: "blend", type: '"normal" | "multiply" | "screen" | "overlay"', required: false, detail: 'Default "normal".' },
    ],
    example: 'place(cutout: "courier", x: 0.72, y: 0.64, scale: 0.92, rotation: -2, opacity: 0.96, blend: "normal")',
  },
  {
    name: "palette",
    syntax: "palette(k?: integer)",
    description: "Calculates the dominant colour palette used by the palette-grid reverse and signature record.",
    parameters: [
      { name: "k", type: "integer", required: false, detail: "3 to 16; default 6." },
    ],
    example: "palette(k: 8)",
    notes: "Only one palette command is allowed.",
  },
  {
    name: "reverse",
    syntax: 'reverse(mode: "provenance-map" | "palette-grid", k?: integer)',
    description: "Declares an inspectable inverse image. Every Robby composition needs at least one.",
    parameters: [
      { name: "mode", type: '"provenance-map" | "palette-grid"', required: true, detail: "The provenance map traces placed layers; the palette grid compresses dominant colour evidence." },
      { name: "k", type: "integer", required: false, detail: "Only for palette-grid; 3 to 16, inheriting palette(k) or defaulting to 6." },
    ],
    example: 'reverse(mode: "palette-grid", k: 8)',
    notes: "v0.1 supports at most two reverse commands.",
  },
  {
    name: "output",
    syntax: "output(obverse: string, reverse: string, manifest: string)",
    description: "Declares the names of the rendered obverse, reverse, and process manifest files.",
    parameters: [
      { name: "obverse", type: "string", required: true, detail: "Output filename for the front image." },
      { name: "reverse", type: "string", required: true, detail: "Output filename for the inverse image." },
      { name: "manifest", type: "string", required: true, detail: "Output filename for the process graph manifest." },
    ],
    example: 'output(obverse: "night-obverse.png", reverse: "night-reverse.png", manifest: "night-manifest.json")',
    notes: "Output must be the final command.",
  },
] as const;
