import { Chapter } from "./chapter";

export class Story {

  title: string;

  creator: string;

  chapters: Chapter[];

  constructor(title: string, creator: string) {

    this.title = title;

    this.creator = creator;

    this.chapters = [];

  }

  addChapter(chapter: Chapter): void {

    this.chapters.push(chapter);

  }

  describe(): void {

    console.log(

      `${this.title} by ${this.creator} contains ${this.chapters.length} chapters.`

    );

  }

}