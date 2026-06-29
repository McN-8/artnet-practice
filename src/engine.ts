import { State } from "./state.js";

export class Engine {

  currentState: State;

  constructor(initialState: State) {

    this.currentState = initialState;

  }

  setState(state: State): void {

    this.currentState = state;

  }

}