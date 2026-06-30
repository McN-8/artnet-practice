import { State } from "./state.js";

import { Prompt } from "./prompt.js";

export class Engine {

  currentState: State;

  states: State[];

  constructor(initialState: State, states: State[]) {

    this.currentState = initialState;

    this.states = states;

  }

preloadStateAssets(state: State): void {
  console.log(`Preloading assets for ${state.id}`);

  for (const asset of state.assets) {
    console.log(`Preloading ${asset.type}: ${asset.file}`);
  }
}

  executePrompt(prompt: Prompt): void {

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