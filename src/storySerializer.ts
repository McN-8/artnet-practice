import { Story } from "./story.js";

export class StorySerializer {
  static toJSON(story: Story): string {
    return JSON.stringify(story, null, 2);
  }
}