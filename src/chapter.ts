import { State } from "./state.js";

export class Chapter {

  title: string;

  states: State[];

  constructor(title: string) {

    this.title = title;

    this.states = [];

  }

  addState(state: State): void {

    this.states.push(state);

  }

}