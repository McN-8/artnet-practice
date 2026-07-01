import { State } from "./state.js";
import { Prompt } from "./prompt.js";
import { AssetCache } from "./assetCache.js";

export class Engine {
  // Runtime State
  currentState: State;
  states: State[];

  // Preloading
  preloadBackwardSpan: number;
  preloadForwardSpan: number;

  // Asset Cache
  assetCache: AssetCache;

  // Fast Forward
  fastForwardActive: boolean;

  constructor(
    initialState: State,
    states: State[],
    preloadBackwardSpan: number = 1,
    preloadForwardSpan: number = 2
  ) {
    this.currentState = initialState;
    this.states = states;
    this.preloadBackwardSpan = preloadBackwardSpan;
    this.preloadForwardSpan = preloadForwardSpan;
    this.assetCache = new AssetCache();
    this.fastForwardActive = false;
  }

  // Asset Preloading
  preloadStateAssets(state: State): void {
    console.log(`Preloading assets for ${state.id}`);

    for (const asset of state.assets) {
      this.assetCache.loadAsset(asset.file);
    }
  }

  preloadNearbyStates(currentIndex: number): void {
    const start = Math.max(
      0,
      currentIndex - this.preloadBackwardSpan
    );

    const end = Math.min(
      this.states.length - 1,
      currentIndex + this.preloadForwardSpan
    );

    for (let i = start; i <= end; i++) {
      if (i === currentIndex) {
        continue;
      }

      this.preloadStateAssets(this.states[i]!);
    }
  }

  unloadDistantStateAssets(currentIndex: number): void {
    const keepStart = Math.max(
      0,
      currentIndex - this.preloadBackwardSpan
    );

    const keepEnd = Math.min(
      this.states.length - 1,
      currentIndex + this.preloadForwardSpan
    );

    for (let i = 0; i < this.states.length; i++) {
      if (i >= keepStart && i <= keepEnd) {
        continue;
      }

      const state = this.states[i];

      if (!state) {
        continue;
      }

      for (const asset of state.assets) {
        this.assetCache.unloadAsset(asset.file);
      }
    }
  }

  // Fast Forward
  enableFastForward(): void {
    this.fastForwardActive = true;
    console.log("Fast forward enabled.");
  }

  disableFastForward(): void {
    this.fastForwardActive = false;
    console.log("Fast forward disabled.");
  }

  // Auto Advance
  scheduleAutoAdvance(): void {
  if (!this.currentState.autoAdvanceEnabled) {
    console.log(`Auto advance disabled for ${this.currentState.id}`);
    return;
  }

  if (!this.currentState.autoAdvancePrompt) {
    console.log(`Auto advance prompt missing for ${this.currentState.id}`);
    return;
  }

  let effectiveDelay = this.currentState.autoAdvanceDelay;

  if (
    this.fastForwardActive &&
    this.currentState.fastForwardEnabled
  ) {
    effectiveDelay =
      this.currentState.autoAdvanceDelay /
      this.currentState.fastForwardMultiplier;
  }

  console.log(
    `Auto advancing from ${this.currentState.id} in ${effectiveDelay}ms.`
  );

  setTimeout(() => {
    if (!this.currentState.autoAdvancePrompt) {
      return;
    }

    this.executePrompt(this.currentState.autoAdvancePrompt);
  }, effectiveDelay);
}

  // Prompt Execution
  executePrompt(prompt: Prompt): void {
    if (this.currentState.inputLocked) {
      console.log(`Input is locked for ${this.currentState.id}. Prompt ignored.`);
      return;
    }

    const destinationState = this.states.find(
      (state) => state.id === prompt.transition.destinationStateId
    );

    if (!destinationState) {
      console.log("Destination state not found.");
      return;
    }

    console.log(
      `Executing ${prompt.inputType} transition with ${prompt.transition.effectType}.`
    );

    console.log(
      `Triggered audio cues: ${prompt.transition.triggeredAudioCues.length}`
    );

    this.preloadStateAssets(destinationState);

    this.currentState.exit();

    this.currentState = destinationState;

    this.currentState.enter();
  }
}