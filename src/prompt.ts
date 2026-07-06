import { InputType } from "./inputType.js";
import { Transition } from "./transition.js";

export class Prompt {
  inputType: InputType;
  transition: Transition;
  targetId: string | undefined;

  constructor(
    inputType: InputType,
    transition: Transition,
    targetId?: string
  ) {
    this.inputType = inputType;
    this.transition = transition;
    this.targetId = targetId;
  }
}