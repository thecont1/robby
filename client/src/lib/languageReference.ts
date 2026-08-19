/** The versioned Robby v1 command reference mirrors `src/validator.rs`. */

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
reverse(mode: "negative")
output(obverse: "source.jpg", reverse: "transient", manifest: "transient")`;

export const languageReference: readonly ReferenceCommand[] = [
  {
    name: "base",
    syntax: 'base(path: string, width?: integer, height?: integer)',
    description: "Declares the JPEG whose exact bytes and RGB matrix are the render inputs. It must be first.",
    parameters: [
      { name: "path", type: "string", required: true, detail: "JPEG basename in the watched gallery directory." },
      { name: "width", type: "positive integer", required: false, detail: "Optional reverse width, 1–4096." },
      { name: "height", type: "positive integer", required: false, detail: "Optional reverse height, 1–4096." },
    ],
    example: 'base("source.jpg", width: 1024, height: 768)',
    notes: "The compiler never derives meaning from depicted content.",
  },
  {
    name: "palette",
    syntax: "palette(k?: integer)",
    description: "Selects the number of RGB clusters supplied to the deterministic render module.",
    parameters: [
      { name: "k", type: "integer", required: false, detail: "3–16; default 8." },
    ],
    example: "palette(k: 8)",
    notes: "Exactly one palette declaration may appear; omission uses k=8.",
  },
  {
    name: "reverse",
    syntax: 'reverse(mode: "negative")',
    description: "Selects the registered pure mathematical reverse module.",
    parameters: [
      { name: "mode", type: '"negative"', required: true, detail: "The v1 registry contains only the negative module." },
    ],
    example: 'reverse(mode: "negative")',
    notes: "Exactly one reverse declaration is required.",
  },
  {
    name: "output",
    syntax: "output(obverse: string, reverse: string, manifest: string)",
    description: "Names logical outputs. Reverse PNG bytes and the manifest remain transient response data.",
    parameters: [
      { name: "obverse", type: "string", required: true, detail: "Logical source name; the JPEG is never rewritten." },
      { name: "reverse", type: "string", required: true, detail: "Logical transient reverse name; never a storage path." },
      { name: "manifest", type: "string", required: true, detail: "Logical transient manifest name; never a storage path." },
    ],
    example: 'output(obverse: "source.jpg", reverse: "transient", manifest: "transient")',
    notes: "Output must be final.",
  },
] as const;
