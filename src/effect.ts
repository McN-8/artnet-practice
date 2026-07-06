export class Effect {
  id: string;
  type: string;
  trigger: string;
  duration: number;

  constructor(
    id: string,
    type: string,
    trigger: string,
    duration: number
  ) {
    this.id = id;
    this.type = type;
    this.trigger = trigger;
    this.duration = duration;
  }
}