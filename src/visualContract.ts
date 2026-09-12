export const ARTNET_COORDINATE_SYSTEM = Object.freeze({
  width: 1600,
  height: 900,
  origin: "topLeft" as const,
  xDirection: "right" as const,
  yDirection: "down" as const,
  units: "logicalPixels" as const,
  scaling: "uniformContain" as const
});

export type VisualLayer =
  | "background"
  | "panels"
  | "overlays"
  | "effects"
  | "dialogue"
  | "interaction";

export const VISUAL_LAYER_ORDER: readonly VisualLayer[] =
  Object.freeze([
    "background",
    "panels",
    "overlays",
    "effects",
    "dialogue",
    "interaction"
  ]);

export interface RenderContext {
  coordinateSystem: typeof ARTNET_COORDINATE_SYSTEM;
  layerOrder: readonly VisualLayer[];
}

export const DEFAULT_RENDER_CONTEXT: RenderContext = Object.freeze({
  coordinateSystem: ARTNET_COORDINATE_SYSTEM,
  layerOrder: VISUAL_LAYER_ORDER
});
