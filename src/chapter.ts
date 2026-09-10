import { State } from "./state.js";

export class Chapter {

  title: string;

  entryStateId: string;

  states: State[];

  constructor(title: string, entryStateId: string = "") {

    this.title = title;

    this.entryStateId = entryStateId;

    this.states = [];

  }

  addState(state: State): void {

    if (this.states.length === 0 && this.entryStateId === "") {
      this.entryStateId = state.id;
    }

    this.states.push(state);

  }

}
