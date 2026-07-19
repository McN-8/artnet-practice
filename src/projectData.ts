import { Story } from "./story.js";
import { ArtNetResources } from "./artNetResources.js";

export class ProjectData {
  constructor(
    public story: Story,
    public resources: ArtNetResources
  ) {}
}