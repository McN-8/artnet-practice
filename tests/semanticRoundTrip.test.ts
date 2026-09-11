import assert from "node:assert/strict";
import test from "node:test";
import { ArtNetResources } from "../src/artNetResources.js";
import { AudioCue } from "../src/audioCue.js";
import { CameraEvent } from "../src/cameraEvent.js";
import { CameraFocalPoint } from "../src/cameraFocalPoint.js";
import { CameraPath } from "../src/cameraPath.js";
import { Chapter } from "../src/chapter.js";
import { Effect } from "../src/effect.js";
import { InputType } from "../src/inputType.js";
import { OverlayAsset } from "../src/overlayAsset.js";
import { PanelGroup } from "../src/panelGroup.js";
import { PanelReveal } from "../src/panelReveal.js";
import { Prompt } from "../src/prompt.js";
import { State } from "../src/state.js";
import { Story } from "../src/story.js";
import { StorySerializer } from "../src/storySerializer.js";
import { Timeline } from "../src/timeline.js";
import { TimelineEvent } from "../src/timelineEvent.js";
import { Transition } from "../src/transition.js";
import { TransitionEffect } from "../src/transitionEffect.js";

test("semantic round trip reconstructs classes and shared resources", () => {
  const story = new Story("Round Trip", "ArtNet");
  const chapter = new Chapter("Chapter", "state-1");
  const first = new State("state-1", "one.png", "One");
  const second = new State("state-2", "two.png", "Two");
  const resources = new ArtNetResources();
  const effect = new Effect("glow", "glow", "timeline", 500);
  const audio = new AudioCue(
    "voice",
    "voice.mp3",
    "voice",
    false,
    0.75,
    "timeline"
  );
  const path = new CameraPath(
    "pan",
    new CameraFocalPoint("start", 0, 0, 1),
    new CameraFocalPoint("end", 10, 20, 2),
    1000,
    "linear"
  );
  const overlay = new OverlayAsset(
    "overlay",
    "overlay.png",
    "pan"
  );
  const panels = new PanelGroup("panels");

  panels.addReveal(new PanelReveal("panel-1", 25));
  resources.effects.register(effect);
  resources.audio.register(audio);
  resources.cameraPaths.register(path);
  resources.overlays.register(overlay);
  resources.panelGroups.register(panels);

  first.addEffect(effect);
  first.addAudioCue(audio);
  first.addCameraPath(path);
  first.addCameraEvent(new CameraEvent(10, path));
  first.addPanelGroup(panels);

  const forward = new Transition(
    "state-2",
    new TransitionEffect("fade", 200, true, true)
  );
  forward.addTriggeredAudioCue(audio);
  first.addPrompt(new Prompt(InputType.TAP_RIGHT, forward));
  second.addPrompt(
    new Prompt(
      InputType.TAP_LEFT,
      new Transition(
        "state-1",
        new TransitionEffect("fade", 200)
      )
    )
  );

  const timeline = new Timeline();
  timeline.addEvent(new TimelineEvent(10, "effect", effect));
  timeline.addEvent(new TimelineEvent(20, "audio", audio));
  timeline.addEvent(new TimelineEvent(30, "camera", path));
  timeline.addEvent(new TimelineEvent(40, "overlay", overlay));
  timeline.addEvent(new TimelineEvent(50, "panelGroup", panels));
  first.setTimeline(timeline);

  chapter.addState(first);
  chapter.addState(second);
  story.addChapter(chapter);

  const serialized = StorySerializer.toJSON(story, resources);
  const loaded = StorySerializer.fromJSON(serialized);
  const loadedChapter = loaded.story.chapters[0]!;
  const loadedState = loadedChapter.states[0]!;

  assert.ok(loaded.story instanceof Story);
  assert.ok(loadedChapter instanceof Chapter);
  assert.ok(loadedState instanceof State);
  assert.ok(loadedState.timeline instanceof Timeline);
  assert.ok(loadedState.timeline.events[0] instanceof TimelineEvent);
  assert.ok(loadedState.prompts[0] instanceof Prompt);
  assert.ok(loadedState.prompts[0]?.transition instanceof Transition);
  assert.ok(
    loadedState.prompts[0]?.transition.effect instanceof TransitionEffect
  );
  assert.ok(loadedState.cameraEvents[0] instanceof CameraEvent);

  assert.equal(
    loadedState.effects[0],
    loaded.resources.effects.get("glow")
  );
  assert.equal(
    loadedState.audioCues[0],
    loaded.resources.audio.get("voice")
  );
  assert.equal(
    loadedState.prompts[0]?.transition.triggeredAudioCues[0],
    loaded.resources.audio.get("voice")
  );
  assert.equal(
    loadedState.cameraEvents[0]?.cameraPath,
    loaded.resources.cameraPaths.get("pan")
  );

  loadedState.timeline.events.forEach((event) => {
    const registries: Record<string, unknown> = {
      effect: loaded.resources.effects.get("glow"),
      audio: loaded.resources.audio.get("voice"),
      camera: loaded.resources.cameraPaths.get("pan"),
      overlay: loaded.resources.overlays.get("overlay"),
      panelGroup: loaded.resources.panelGroups.get("panels")
    };

    assert.equal(event.payload, registries[event.type]);
  });

  assert.deepEqual(
    JSON.parse(StorySerializer.toJSON(loaded.story, loaded.resources)),
    JSON.parse(serialized)
  );
});
