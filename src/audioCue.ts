export class AudioCue {

  file: string;

  type: string;

  loop: boolean;

  volume: number;

  trigger: string;

  persistsAcrossStates: boolean;

  constructor(

    file: string,

    type: string,

    loop: boolean,

    volume: number,

    trigger: string,

    persistsAcrossStates: boolean = false

  ) {

    this.file = file;

    this.type = type;

    this.loop = loop;

    this.volume = volume;

    this.trigger = trigger;

    this.persistsAcrossStates = persistsAcrossStates;

  }

}