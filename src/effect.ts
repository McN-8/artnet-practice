export class Effect {

  type: string;

  trigger: string;

  duration: number;

  constructor(type: string, trigger: string, duration: number) {

    this.type = type;

    this.trigger = trigger;

    this.duration = duration;

  }

}