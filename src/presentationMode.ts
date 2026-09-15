export const PRESENTATION_MODES = [
  "interactive",
  "paged",
  "verticalScroll"
] as const;

export type PresentationMode =
  (typeof PRESENTATION_MODES)[number];

export function isTraditionalPresentationMode(
  mode: PresentationMode
): boolean {
  return mode === "paged" || mode === "verticalScroll";
}
