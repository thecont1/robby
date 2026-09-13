export const EPISTEMIC_CLASSES = [
  "observed",
  "verified",
  "measured",
  "derived",
  "declared",
  "redacted",
  "unavailable",
] as const;

export type EpistemicClass = (typeof EPISTEMIC_CLASSES)[number];

export function isEpistemicClass(value: unknown): value is EpistemicClass {
  return typeof value === "string" && (EPISTEMIC_CLASSES as readonly string[]).includes(value);
}

export function displayEpistemicClass(value: EpistemicClass): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
