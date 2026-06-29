import { State } from "./state.js";

import { Prompt } from "./prompt.js";

export class Engine {

  currentState: State;

  states: State[];

  constructor(initialState: State, states: State[]) {

    this.currentState = initialState;

    this.states = states;

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

    this.currentState = destinationState;

  }

}