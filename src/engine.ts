import { State } from "./state.js";
import { Prompt } from "./prompt.js";
import { AssetCache } from "./assetCache.js";
import { AudioStack } from "./audioStack.js";
import { PanelGroup } from "./panelGroup.js";

export class Engine {
  // Runtime State
  currentState: State;
  states: State[];

  // Preloading
  preloadBackwardSpan: number;
  preloadForwardSpan: number;

  // Asset Cache
  assetCache: AssetCache;

  activeTimers: ReturnType<typeof setTimeout>[];

  // Audio Stack
  audioStack: AudioStack;

  // Fast Forward
  fastForwardActive: boolean;

  constructor(
    initialState: State,
    states: State[],
    audioStack: AudioStack,
    preloadBackwardSpan: number = 1,
    preloadForwardSpan: number = 2
  ) {
    this.currentState = initialState;
    this.states = states;
    this.audioStack = audioStack;
    this.preloadBackwardSpan = preloadBackwardSpan;
    this.preloadForwardSpan = preloadForwardSpan;
    this.assetCache = new AssetCache();
    this.activeTimers = [];
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

  // Audio Layers
  applyAudioLayerRules(state: State): void {
    for (const layerId of state.audioLayersToActivate) {
      this.audioStack.activateLayer(layerId);
    }

    for (const layerId of state.audioLayersToDeactivate) {
      this.audioStack.deactivateLayer(layerId);
    }
  }

  // Timeline
  playTimeline(state: State): void {
    for (const event of state.timeline.events) {
      const timer = setTimeout(() => {
        switch (event.type) {
          case "camera":
            console.log(
              `Starting camera event: ${
                (event.payload as { id: string }).id
              }`
            );
            break;

          case "effect":
            console.log(
              `Starting effect event: ${
                (event.payload as { type: string }).type
              }`
            );
            break;

          case "audio":
            console.log(
              `Starting audio event: ${
                (event.payload as { file: string }).file
              }`
            );
            break;

          case "overlay":
            console.log(
              `Starting overlay event: ${
                (event.payload as { asset: string }).asset
              }`
            );
            break;

          case "panelGroup":
            console.log(
              `Starting panel group event: ${
                (event.payload as { id: string }).id
              }`
            );

            this.playPanelGroup(
                event.payload as PanelGroup
            );
            break;

          default:
            console.log(
              `Timeline Event [${event.type}] triggered.`
            );
        }
      }, event.timestamp);
      this.registerTimer(timer);
    }
  }

  // Panel Groups
  playPanelGroup(panelGroup: PanelGroup): void {
    for (const reveal of panelGroup.reveals) {
      const timer = setTimeout(() => {
        console.log(
          `Revealing panel ${reveal.panelId}.`
        );
      }, reveal.delay);
      this.registerTimer(timer);
    }
  }

  // Active Timer

  registerTimer(timer: ReturnType<typeof setTimeout>): void {
  this.activeTimers.push(timer);
 }

    clearActiveTimers(): void {
  for (const timer of this.activeTimers) {
    clearTimeout(timer);
  }

  this.activeTimers = [];

  console.log("Cleared active timers.");
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

  // Timer Cleanup
  startState(state: State): void {
  this.clearActiveTimers();
  this.applyAudioLayerRules(state);
  this.playTimeline(state);
 }

  // Transition Pipeline
  prepareTransition(destinationState: State): void {
    this.preloadStateAssets(destinationState);
  }

  finalizeTransition(): void {
  this.startState(this.currentState);
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
      `Executing ${prompt.inputType} transition with ${prompt.transition.effect.type}.`
    );

    if (prompt.transition.effect.locksInput) {
      console.log("Transition locking input.");
    }

    if (
      this.fastForwardActive &&
      !prompt.transition.effect.allowFastForward
    ) {
      console.log(
        "Fast forward blocked by transition."
      );
    }

    console.log(
      `Triggered audio cues: ${prompt.transition.triggeredAudioCues.length}`
    );

    this.prepareTransition(destinationState);

    this.clearActiveTimers();

    this.currentState.exit();

    this.currentState = destinationState;

    this.currentState.enter();

    this.finalizeTransition();
  }
}