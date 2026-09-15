import { Chapter } from "./chapter.js";
import type { PresentationMode } from "./presentationMode.js";

export class Story {

  title: string;

  creator: string;

  chapters: Chapter[];

  presentationMode: PresentationMode;

  constructor(
    title: string,
    creator: string,
    presentationMode: PresentationMode = "interactive"
  ) {

    this.title = title;

    this.creator = creator;

    this.presentationMode = presentationMode;

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
