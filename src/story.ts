export class Story {

  title: string;

  creator: string;

  constructor(title: string, creator: string) {

    this.title = title;

    this.creator = creator;

  }

  describe(): void {

    console.log(`${this.title} was created by ${this.creator}.`);

  }

}