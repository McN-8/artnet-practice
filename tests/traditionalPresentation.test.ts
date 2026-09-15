import assert from "node:assert/strict";
import test from "node:test";
import { AudioStack } from "../src/audioStack.js";
import { Engine } from "../src/engine.js";
import type { Renderer } from "../src/renderer.js";
import { StorySerializer } from "../src/storySerializer.js";
import { importTraditionalPages } from "../src/traditionalPageImport.js";
import {
  ProjectValidationError,
  validateProjectDocument
} from "../src/projectValidation.js";

const pages = [
  {
    file: "page-one.png",
    accessibleDescription: "A traveler enters the forest."
  },
  {
    file: "page-two.png",
    accessibleDescription: "The traveler finds a glowing tree."
  }
];

function silentRenderer(rendered: string[]): Renderer {
  return {
    renderState: (state) => rendered.push(state.id),
    revealPanel: () => {},
    runCameraPath: () => {},
    runEffect: () => {},
    displayOverlay: () => {}
  };
}

test("traditional importer creates a minimal reusable paged project", () => {
  const project = importTraditionalPages({
    title: "Forest Pages",
    creator: "ArtNet",
    chapterTitle: "Arrival",
    pages
  });
  const chapter = project.story.chapters[0]!;

  assert.equal(project.story.presentationMode, "paged");
  assert.equal(chapter.entryStateId, "page-1");
  assert.equal(chapter.states.length, 2);
  assert.deepEqual(chapter.states.map((state) => state.prompts), [[], []]);
  assert.deepEqual(chapter.states.map((state) => state.timeline.events), [[], []]);
  assert.deepEqual(chapter.states.map((state) => state.isEnding), [false, true]);
  assert.equal(project.resources.panels.get("page-1")?.asset, "page-one.png");
  assert.equal(chapter.states[0]?.assets[0]?.file, "page-one.png");
});

test("traditional presentation survives semantic serialization", () => {
  const project = importTraditionalPages({
    title: "Scroll Story",
    creator: "ArtNet",
    chapterTitle: "Chapter",
    pages,
    presentationMode: "verticalScroll"
  });
  const json = StorySerializer.toJSON(project.story, project.resources);
  const loaded = StorySerializer.fromJSON(json);

  assert.equal(loaded.story.presentationMode, "verticalScroll");
  assert.deepEqual(
    loaded.story.chapters[0]?.states.map((state) => state.image),
    ["page-one.png", "page-two.png"]
  );
});

test("missing presentation mode defaults existing version-1 projects to interactive", () => {
  const project = importTraditionalPages({
    title: "Compatibility",
    creator: "ArtNet",
    chapterTitle: "Chapter",
    pages: [pages[0]!]
  });
  const document = JSON.parse(
    StorySerializer.toJSON(project.story, project.resources)
  );

  delete document.presentationMode;
  document.chapters[0].states[0].prompts = [];
  document.chapters[0].states[0].isEnding = true;

  validateProjectDocument(document);
  assert.equal(document.presentationMode, "interactive");
});

test("traditional validation reports mode and nested page-contract errors", () => {
  const project = importTraditionalPages({
    title: "Invalid Pages",
    creator: "ArtNet",
    chapterTitle: "Chapter",
    pages
  });
  const document = JSON.parse(
    StorySerializer.toJSON(project.story, project.resources)
  );

  document.presentationMode = "slideshow";
  assert.throws(
    () => validateProjectDocument(document),
    (error: unknown) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.equal(error.issues[0]?.path, "$.presentationMode");
      return true;
    }
  );

  document.presentationMode = "paged";
  document.chapters[0].states[0].isEnding = true;
  assert.throws(
    () => validateProjectDocument(document),
    (error: unknown) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.ok(error.issues.some((issue) =>
        issue.path === "$.chapters[0].states[0].isEnding"
      ));
      return true;
    }
  );
});

test("traditional playback advances and returns without authored prompts", () => {
  const project = importTraditionalPages({
    title: "Playback",
    creator: "ArtNet",
    chapterTitle: "Chapter",
    pages
  });
  const states = project.story.chapters[0]!.states;
  const rendered: string[] = [];
  const engine = new Engine(
    states[0]!,
    states,
    new AudioStack(),
    1,
    2,
    undefined,
    silentRenderer(rendered),
    undefined,
    project.story.presentationMode
  );

  engine.startState(states[0]!);
  assert.equal(engine.advanceTraditionalPage(), true);
  assert.equal(engine.currentState.id, "page-2");
  assert.equal(engine.advanceTraditionalPage(), false);
  assert.equal(engine.returnToPreviousTraditionalPage(), true);
  assert.equal(engine.currentState.id, "page-1");
  assert.deepEqual(rendered, ["page-1", "page-2", "page-1"]);
  assert.equal(engine.activeTimers.length, 0);
});
