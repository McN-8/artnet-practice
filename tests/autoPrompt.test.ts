import assert from "node:assert/strict";
import test from "node:test";
import { ArtNetResources } from "../src/artNetResources.js";
import { AudioStack } from "../src/audioStack.js";
import { Chapter } from "../src/chapter.js";
import { DeterministicClock } from "../src/clock.js";
import { Engine } from "../src/engine.js";
import { InputType } from "../src/inputType.js";
import { Prompt } from "../src/prompt.js";
import {
  ProjectValidationError,
  validateProjectDocument
} from "../src/projectValidation.js";
import { State } from "../src/state.js";
import { Story } from "../src/story.js";
import { StorySerializer } from "../src/storySerializer.js";
import { Transition } from "../src/transition.js";
import { TransitionEffect } from "../src/transitionEffect.js";

function autoPrompt(destination: string): Prompt {
  return new Prompt(
    InputType.TAP_RIGHT,
    new Transition(destination, new TransitionEffect("fade", 100))
  );
}

function createAutoStory(): {
  story: Story;
  resources: ArtNetResources;
  first: State;
  second: State;
} {
  const story = new Story("Hands Free", "ArtNet");
  const chapter = new Chapter("Chapter");
  const first = new State("first", "first.png", "First page");
  const second = new State("second", "second.png", "Second page");
  const resources = new ArtNetResources();

  first.enableAutoAdvance(100, autoPrompt("second"));
  second.isEnding = true;
  chapter.addState(first);
  chapter.addState(second);
  story.addChapter(chapter);
  return { story, resources, first, second };
}

test("auto prompt serializes and rebuilds as a real prompt", () => {
  const { story, resources } = createAutoStory();
  const json = StorySerializer.toJSON(story, resources);
  const document = JSON.parse(json);
  const serializedPrompt =
    document.chapters[0].states[0].autoAdvancePrompt;

  assert.equal(serializedPrompt.transition.destinationStateId, "second");

  const loaded = StorySerializer.fromJSON(json);
  const loadedState = loaded.story.chapters[0]!.states[0]!;
  assert.ok(loadedState.autoAdvancePrompt instanceof Prompt);
  assert.ok(loadedState.autoAdvancePrompt.transition instanceof Transition);
  assert.equal(
    loadedState.autoAdvancePrompt.transition.destinationStateId,
    "second"
  );
});

test("hands-free defaults off and reader multiplier controls timing", () => {
  const { first, second } = createAutoStory();
  const clock = new DeterministicClock();
  const engine = new Engine(
    first,
    [first, second],
    new AudioStack(),
    1,
    2,
    clock
  );

  engine.startState(first);
  clock.advanceBy(500);
  assert.equal(engine.currentState, first);

  engine.setReaderTimingPreferences({
    handsFreeEnabled: true,
    autoPromptTimingMultiplier: 2
  });
  clock.advanceBy(199);
  assert.equal(engine.currentState, first);
  clock.advanceBy(1);
  assert.equal(engine.currentState, second);
});

test("reader can pause, resume, and skip an auto prompt", () => {
  const { first, second } = createAutoStory();
  const clock = new DeterministicClock();
  const engine = new Engine(
    first,
    [first, second],
    new AudioStack(),
    1,
    2,
    clock,
    undefined,
    undefined,
    undefined,
    { handsFreeEnabled: true, autoPromptTimingMultiplier: 1 }
  );

  engine.startState(first);
  engine.pauseAutoPrompt();
  clock.advanceBy(100);
  assert.equal(engine.currentState, first);

  engine.resumeAutoPrompt();
  clock.advanceBy(50);
  assert.equal(engine.skipAutoPromptDelay(), true);
  assert.equal(engine.currentState, second);
  assert.equal(clock.pendingTimerCount, 0);
});

test("auto-prompt validation reports nested and reference paths", () => {
  const { story, resources } = createAutoStory();
  const document = JSON.parse(StorySerializer.toJSON(story, resources));
  const prompt = document.chapters[0].states[0].autoAdvancePrompt;

  prompt.transition.destinationStateId = "missing";
  prompt.transition.effect.duration = -1;

  assert.throws(
    () => validateProjectDocument(document),
    (error: unknown) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.ok(error.issues.some((issue) =>
        issue.path ===
          "$.chapters[0].states[0].autoAdvancePrompt.transition.effect.duration"
      ));
      return true;
    }
  );

  prompt.transition.effect.duration = 100;

  assert.throws(
    () => validateProjectDocument(document),
    (error: unknown) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.ok(error.issues.some((issue) =>
        issue.path ===
          "$.chapters[0].states[0].autoAdvancePrompt.transition.destinationStateId"
      ));
      return true;
    }
  );
});
