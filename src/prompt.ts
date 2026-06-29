import { InputType } from "./inputType.js";

import { Transition } from "./transition.js";

export class Prompt {

  inputType: InputType;

  transition: Transition;

  constructor(inputType: InputType, transition: Transition) {

    this.inputType = inputType;

    this.transition = transition;

  }

}