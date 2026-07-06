import { Story } from "./story.js";

export class StorySerializer {
  static toJSON(story: Story): string {
    const exportData = {
      title: story.title,
      creator: story.creator,
      chapters: story.chapters
    };

    return JSON.stringify(exportData, null, 2);
  }
}