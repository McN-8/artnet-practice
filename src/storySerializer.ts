import { Story } from "./story.js";

export class StorySerializer {
  static toJSON(story: Story): string {
    const exportData = {
      title: story.title,
      creator: story.creator,
      chapters: story.chapters.map((chapter) => ({
        title: chapter.title,
        states: chapter.states
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }
}