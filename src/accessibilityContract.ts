import { InputType } from "./inputType.js";

export const ACCESSIBILITY_CONTRACT_VERSION = 1;

export interface AccessibilityPreferences {
  reducedMotion: boolean;
  captionsEnabled: boolean;
  audioDescriptionsEnabled: boolean;
}

export const DEFAULT_ACCESSIBILITY_PREFERENCES:
  Readonly<AccessibilityPreferences> = Object.freeze({
    reducedMotion: false,
    captionsEnabled: true,
    audioDescriptionsEnabled: false
  });

export interface InputEquivalents {
  keyboard: readonly string[];
  touch: readonly string[];
}

export const INPUT_EQUIVALENTS_V1: Readonly<
  Record<InputType, InputEquivalents>
> = Object.freeze({
  [InputType.TAP_RIGHT]: {
    keyboard: ["ArrowRight", "Enter"],
    touch: ["tapRight"]
  },
  [InputType.TAP_LEFT]: {
    keyboard: ["ArrowLeft"],
    touch: ["tapLeft"]
  },
  [InputType.HOLD]: {
    keyboard: ["Space"],
    touch: ["pressAndHold"]
  },
  [InputType.DOUBLE_TAP]: {
    keyboard: ["Enter"],
    touch: ["doubleTap"]
  },
  [InputType.SWIPE_UP]: {
    keyboard: ["ArrowUp"],
    touch: ["swipeUp"]
  },
  [InputType.SWIPE_DOWN]: {
    keyboard: ["ArrowDown"],
    touch: ["swipeDown"]
  },
  [InputType.PINCH_ZOOM]: {
    keyboard: ["+", "="],
    touch: ["pinchZoom"]
  }
});

export const REDUCED_MOTION_MAX_ESSENTIAL_DURATION_MS = 100;

export function resolveMotionDuration(
  duration: number,
  reducedMotion: boolean,
  essential: boolean = false
): number {
  if (!reducedMotion) {
    return duration;
  }

  return essential
    ? Math.min(duration, REDUCED_MOTION_MAX_ESSENTIAL_DURATION_MS)
    : 0;
}
