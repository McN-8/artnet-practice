export interface ReaderTimingPreferences {
  handsFreeEnabled: boolean;
  autoPromptTimingMultiplier: number;
}

export const MIN_AUTO_PROMPT_TIMING_MULTIPLIER = 0.25;
export const MAX_AUTO_PROMPT_TIMING_MULTIPLIER = 4;

export const DEFAULT_READER_TIMING_PREFERENCES:
  Readonly<ReaderTimingPreferences> = Object.freeze({
    handsFreeEnabled: false,
    autoPromptTimingMultiplier: 1
  });

export function validateReaderTimingPreferences(
  preferences: Readonly<ReaderTimingPreferences>
): void {
  if (typeof preferences.handsFreeEnabled !== "boolean") {
    throw new TypeError("handsFreeEnabled must be a boolean");
  }

  if (
    !Number.isFinite(preferences.autoPromptTimingMultiplier) ||
    preferences.autoPromptTimingMultiplier <
      MIN_AUTO_PROMPT_TIMING_MULTIPLIER ||
    preferences.autoPromptTimingMultiplier >
      MAX_AUTO_PROMPT_TIMING_MULTIPLIER
  ) {
    throw new RangeError(
      "autoPromptTimingMultiplier must be between 0.25 and 4"
    );
  }
}
