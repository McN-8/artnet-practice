import { ArtNetResources } from "./artNetResources.js";
import { Asset } from "./asset.js";
import { Chapter } from "./chapter.js";
import { Panel } from "./panel.js";
import type { PresentationMode } from "./presentationMode.js";
import { isTraditionalPresentationMode } from "./presentationMode.js";
import { ProjectData } from "./projectData.js";
import { State } from "./state.js";
import { Story } from "./story.js";

export interface TraditionalPageSource {
  file: string;
  accessibleDescription: string;
}

export interface TraditionalPageImportOptions {
  title: string;
  creator: string;
  chapterTitle: string;
  pages: readonly TraditionalPageSource[];
  presentationMode?: PresentationMode;
}

export function importTraditionalPages(
  options: TraditionalPageImportOptions
): ProjectData {
  const mode = options.presentationMode ?? "paged";

  if (!isTraditionalPresentationMode(mode)) {
    throw new Error(
      "Traditional page import requires paged or verticalScroll presentation"
    );
  }

  if (options.pages.length === 0) {
    throw new Error("Traditional page import requires at least one page");
  }

  const story = new Story(options.title, options.creator, mode);
  const chapter = new Chapter(options.chapterTitle);
  const resources = new ArtNetResources();

  options.pages.forEach((page, index) => {
    const number = index + 1;
    const id = `page-${number}`;
    const description = page.accessibleDescription.trim();

    if (page.file.trim().length === 0 || description.length === 0) {
      throw new Error(
        `Traditional page ${number} requires a file and accessible description`
      );
    }

    const state = new State(id, page.file, description);
    state.isEnding = index === options.pages.length - 1;
    state.addAsset(new Asset(page.file, "image"));
    chapter.addState(state);
    resources.panels.register(new Panel(id, page.file, description));
  });

  story.addChapter(chapter);
  return new ProjectData(story, resources);
}
