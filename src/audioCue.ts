export class AudioCue {

  file: string;

  type: string;

  loop: boolean;

  volume: number;

  trigger: string;

  constructor(

    file: string,

    type: string,

    loop: boolean,

    volume: number,

    trigger: string

  ) {

    this.file = file;

    this.type = type;

    this.loop = loop;

    this.volume = volume;

    this.trigger = trigger;

  }

}