import assert from "node:assert/strict";
import test from "node:test";
import { AudioStack } from "../src/audioStack.js";
import { DeterministicClock } from "../src/clock.js";
import { Effect } from "../src/effect.js";
import { Engine } from "../src/engine.js";
import { Chapter } from "../src/chapter.js";
import { InputType } from "../src/inputType.js";
import { Prompt } from "../src/prompt.js";
import {
  createProgressSnapshot,
  parseProgressSnapshot,
  ProgressSnapshotValidationError,
  restoreProgressSnapshot,
  serializeProgressSnapshot,
  validateProgressSnapshot
} from "../src/progressSnapshot.js";
import type { Renderer } from "../src/renderer.js";
import { State } from "../src/state.js";
import { StatePhase } from "../src/statePhase.js";
import { Story } from "../src/story.js";
import { TimelineEvent } from "../src/timelineEvent.js";
import { Transition } from "../src/transition.js";
import { TransitionEffect } from "../src/transitionEffect.js";

const STORY_VERSION = "story-build-7";

function createStory(): {
  story: Story;
  first: State;
  second: State;
} {
  const story = new Story("Snapshot Story", "ArtNet");
  const chapter = new Chapter("Chapter One", "state-1");
  const first = new State("state-1", "one.png", "One");
  const second = new State("state-2", "two.png", "Two");

  chapter.addState(first);
  chapter.addState(second);
  story.addChapter(chapter);
  return { story, first, second };
}

function silentRenderer(effectIds: string[] = []): Renderer {
  return {
    renderState() {},
    revealPanel() {},
    runCameraPath() {},
    runEffect(effect) {
      effectIds.push(effect.id);
    },
    displayOverlay() {}
  };
}

function createEngine(
  initialState: State,
  states: State[],
  clock: DeterministicClock,
  renderer: Renderer = silentRenderer()
): Engine {
  return new Engine(
    initialState,
    states,
    new AudioStack(),
    1,
    2,
    clock,
    renderer
  );
}

test("progress snapshot captures versioned reader state", () => {
  const { story, first, second } = createStory();
  const engine = createEngine(
    second,
    [first, second],
    new DeterministicClock()
  );

  engine.navigationHistory = ["state-1"];
  engine.fastForwardActive = true;

  assert.deepEqual(
    createProgressSnapshot(engine, story, STORY_VERSION),
    {
      snapshotVersion: 1,
      projectSchemaVersion: 1,
      storyTitle: "Snapshot Story",
      storyVersion: STORY_VERSION,
      chapterIndex: 0,
      currentStateId: "state-2",
      navigationHistory: ["state-1"],
      fastForwardEnabled: true,
      handsFreeEnabled: false,
      autoPromptTimingMultiplier: 1,
      lifecyclePosition: "stateStart"
    }
  );
});

test("progress snapshot JSON round trip validates its context", () => {
  const { story, first, second } = createStory();
  const engine = createEngine(
    first,
    [first, second],
    new DeterministicClock()
  );
  const snapshot = createProgressSnapshot(
    engine,
    story,
    STORY_VERSION
  );

  assert.deepEqual(
    parseProgressSnapshot(
      serializeProgressSnapshot(snapshot),
      story,
      STORY_VERSION
    ),
    snapshot
  );

  assert.throws(
    () => parseProgressSnapshot("{", story, STORY_VERSION),
    (error) => {
      assert.ok(error instanceof ProgressSnapshotValidationError);
      assert.deepEqual(error.issues, [
        { path: "$", message: "must contain valid JSON" }
      ]);
      return true;
    }
  );
});

test("snapshot validation aggregates path-specific structural errors", () => {
  const { story } = createStory();

  assert.throws(
    () => validateProgressSnapshot(
      {
        snapshotVersion: 2,
        projectSchemaVersion: 0,
        storyTitle: 4,
        storyVersion: null,
        chapterIndex: 0.5,
        currentStateId: false,
        navigationHistory: ["state-1", 9],
        fastForwardEnabled: "yes",
        handsFreeEnabled: "yes",
        autoPromptTimingMultiplier: 9,
        lifecyclePosition: "midTimeline",
        unknown: true
      },
      story,
      STORY_VERSION
    ),
    (error) => {
      assert.ok(error instanceof ProgressSnapshotValidationError);
      assert.deepEqual(
        error.issues.map((issue) => issue.path),
        [
          "$.unknown",
          "$.snapshotVersion",
          "$.projectSchemaVersion",
          "$.storyTitle",
          "$.storyVersion",
          "$.currentStateId",
          "$.chapterIndex",
          "$.fastForwardEnabled",
          "$.handsFreeEnabled",
          "$.autoPromptTimingMultiplier",
          "$.navigationHistory[1]",
          "$.lifecyclePosition"
        ]
      );
      return true;
    }
  );
});

test("snapshot validation rejects mismatched story references", () => {
  const { story } = createStory();
  const snapshot = {
    snapshotVersion: 1,
    projectSchemaVersion: 1,
    storyTitle: "Different Story",
    storyVersion: "old-build",
    chapterIndex: 0,
    currentStateId: "missing-from-chapter",
    navigationHistory: ["missing-history"],
    fastForwardEnabled: false,
    lifecyclePosition: "stateStart"
  };

  assert.throws(
    () => validateProgressSnapshot(snapshot, story, STORY_VERSION),
    (error) => {
      assert.ok(error instanceof ProgressSnapshotValidationError);
      assert.deepEqual(error.issues, [
        {
          path: "$.storyTitle",
          message: "must match loaded story title \"Snapshot Story\""
        },
        {
          path: "$.storyVersion",
          message:
            "must match loaded story version \"story-build-7\""
        },
        {
          path: "$.currentStateId",
          message: "must reference a state in chapter 0"
        },
        {
          path: "$.navigationHistory[0]",
          message: "references missing state \"missing-history\""
        }
      ]);
      return true;
    }
  );
});

test("restoration restarts state timing deterministically", () => {
  const { story, first, second } = createStory();
  const clock = new DeterministicClock();
  const fired: string[] = [];
  const engine = createEngine(
    first,
    [first, second],
    clock,
    silentRenderer(fired)
  );

  first.timeline.addEvent(
    new TimelineEvent(
      10,
      "effect",
      new Effect("abandoned", "glow", "timeline", 1)
    )
  );
  second.fastForwardMultiplier = 2;
  second.timeline.addEvent(
    new TimelineEvent(
      100,
      "effect",
      new Effect("restored", "glow", "timeline", 1)
    )
  );

  engine.startState(first);

  const snapshot = {
    snapshotVersion: 1,
    projectSchemaVersion: 1,
    storyTitle: story.title,
    storyVersion: STORY_VERSION,
    chapterIndex: 0,
    currentStateId: "state-2",
    navigationHistory: ["state-1"],
    fastForwardEnabled: true,
    handsFreeEnabled: true,
    autoPromptTimingMultiplier: 1.5,
    lifecyclePosition: "stateStart"
  };

  restoreProgressSnapshot(snapshot, engine, story, STORY_VERSION);

  assert.equal(engine.currentState, second);
  assert.deepEqual(engine.navigationHistory, ["state-1"]);
  assert.equal(engine.fastForwardActive, true);
  assert.deepEqual(engine.readerTimingPreferences, {
    handsFreeEnabled: true,
    autoPromptTimingMultiplier: 1.5
  });
  assert.equal(second.currentPhase, StatePhase.ACTIVE);

  clock.advanceBy(49);
  assert.deepEqual(fired, []);
  clock.advanceBy(1);
  assert.deepEqual(fired, ["restored"]);
});

test("engine navigation history feeds subsequent snapshots", () => {
  const { story, first, second } = createStory();
  const transition = new Transition(
    "state-2",
    new TransitionEffect("none", 0)
  );
  const engine = createEngine(
    first,
    [first, second],
    new DeterministicClock()
  );

  first.addPrompt(new Prompt(InputType.TAP_RIGHT, transition));
  engine.executePrompt(first.prompts[0]!);

  const snapshot = createProgressSnapshot(
    engine,
    story,
    STORY_VERSION
  );

  assert.equal(snapshot.currentStateId, "state-2");
  assert.deepEqual(snapshot.navigationHistory, ["state-1"]);
});

test("invalid restoration does not mutate engine state", () => {
  const { story, first, second } = createStory();
  const engine = createEngine(
    first,
    [first, second],
    new DeterministicClock()
  );
  const invalidSnapshot = {
    snapshotVersion: 1,
    projectSchemaVersion: 1,
    storyTitle: story.title,
    storyVersion: STORY_VERSION,
    chapterIndex: 0,
    currentStateId: "missing",
    navigationHistory: [],
    fastForwardEnabled: true,
    lifecyclePosition: "stateStart"
  };

  assert.throws(() => restoreProgressSnapshot(
    invalidSnapshot,
    engine,
    story,
    STORY_VERSION
  ));
  assert.equal(engine.currentState, first);
  assert.equal(engine.fastForwardActive, false);
  assert.deepEqual(engine.navigationHistory, []);
});
