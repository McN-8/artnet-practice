export class TransitionEffect {
  type: string;
  duration: number;
  allowFastForward: boolean;
  locksInput: boolean;

  constructor(
    type: string,
    duration: number,
    allowFastForward: boolean = true,
    locksInput: boolean = false
  ) {
    this.type = type;
    this.duration = duration;
    this.allowFastForward = allowFastForward;
    this.locksInput = locksInput;
  }
}