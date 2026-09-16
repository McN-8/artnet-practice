export const MASK_SHAPES = ["rectangle", "ellipse"] as const;
export const DEFORMATION_TYPES = ["none", "stretch", "squeeze"] as const;

export interface VisualTransform {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  skewX: number;
  skewY: number;
  originX: number;
  originY: number;
  flipX: boolean;
  flipY: boolean;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualMask {
  shape: (typeof MASK_SHAPES)[number];
  feather: number;
}

export interface VisualAppearance {
  opacity: number;
  filter: string;
  outlineWidth: number;
  outlineColor: string;
}

export interface VisualDeformation {
  type: (typeof DEFORMATION_TYPES)[number];
  amountX: number;
  amountY: number;
}

export interface VisualTreatment {
  transform: VisualTransform;
  appearance: VisualAppearance;
  deformation: VisualDeformation;
  crop?: CropRect;
  mask?: VisualMask;
}

export function createDefaultVisualTreatment(): VisualTreatment {
  return {
    transform: {
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      skewX: 0,
      skewY: 0,
      originX: 0.5,
      originY: 0.5,
      flipX: false,
      flipY: false
    },
    appearance: {
      opacity: 1,
      filter: "none",
      outlineWidth: 0,
      outlineColor: "transparent"
    },
    deformation: {
      type: "none",
      amountX: 0,
      amountY: 0
    }
  };
}

export function cloneVisualTreatment(
  treatment: VisualTreatment
): VisualTreatment {
  return structuredClone(treatment);
}
