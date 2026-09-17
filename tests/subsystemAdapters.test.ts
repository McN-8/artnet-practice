import assert from "node:assert/strict";
import test from "node:test";
import { ArtNetResources } from "../src/artNetResources.js";
import { Asset } from "../src/asset.js";
import { AudioCue } from "../src/audioCue.js";
import { AudioStack } from "../src/audioStack.js";
import { Chapter } from "../src/chapter.js";
import { DeterministicClock } from "../src/clock.js";
import { Engine } from "../src/engine.js";
import { InputType } from "../src/inputType.js";
import { Prompt } from "../src/prompt.js";
import {
  MemoryTextStorage, ProjectRepository
} from "../src/projectRepository.js";
import { ProjectData } from "../src/projectData.js";
import { createProgressSnapshot } from "../src/progressSnapshot.js";
import { State } from "../src/state.js";
import { Story } from "../src/story.js";
import type {
  AssetLoader, AudioPlayback
} from "../src/subsystemAdapters.js";
import { ManualInputSource } from "../src/subsystemAdapters.js";
import { Transition } from "../src/transition.js";
import { TransitionEffect } from "../src/transitionEffect.js";

function createProject(): {
  project: ProjectData;
  first: State;
  second: State;
  trigger: AudioCue;
} {
  const story = new Story("Adapters", "ArtNet");
  const chapter = new Chapter("Chapter");
  const first = new State("first", "first.png", "First panel");
  const second = new State("second", "second.png", "Second panel");
  const resources = new ArtNetResources();
  const trigger = new AudioCue(
    "turn", "turn.wav", "soundEffect", false, 1,
    "onPrompt", false, 0, 0, "effects"
  );
  const ambience = new AudioCue(
    "ambience", "wind.wav", "ambience", true, 0.5,
    "onEnterState", false, 0, 0, "world"
  );
  resources.audio.register(trigger);
  resources.audio.register(ambience);
  first.addAudioCue(ambience);
  first.addAsset(new Asset("first.png", "image"));
  second.addAsset(new Asset("second.png", "image"));
  first.activateAudioLayer("world");
  second.deactivateAudioLayer("world");
  const transition = new Transition(
    "second", new TransitionEffect("none", 0)
  );
  transition.addTriggeredAudioCue(trigger);
  first.addPrompt(new Prompt(InputType.TAP_RIGHT, transition));
  second.isEnding = true;
  chapter.addState(first);
  chapter.addState(second);
  story.addChapter(chapter);
  return {project: new ProjectData(story, resources), first, second, trigger};
}

test("injected input, asset, and audio adapters follow transition lifecycle", () => {
  const {first, second} = createProject();
  const calls: string[] = [];
  const loaded = new Set<string>();
  const assets: AssetLoader = {
    loadAsset: (asset) => {
      calls.push(`load:${asset.file}`);
      loaded.add(asset.file);
    },
    unloadAsset: (asset) => {
      calls.push(`unload:${asset.file}`);
      loaded.delete(asset.file);
    },
    hasAsset: (asset) => loaded.has(asset.file)
  };
  const audio: AudioPlayback = {
    playCue: (cue) => { calls.push(`play:${cue.id}`); },
    stopCue: (cue) => { calls.push(`stop:${cue.id}`); },
    activateLayer: (id) => { calls.push(`activate:${id}`); },
    deactivateLayer: (id) => { calls.push(`deactivate:${id}`); }
  };
  const input = new ManualInputSource();
  const engine = new Engine(
    first, [first, second], new AudioStack(),
    1, 2, new DeterministicClock(),
    undefined, undefined, undefined, undefined, undefined,
    assets, audio
  );
  const unbind = engine.bindInput(input);
  engine.startState(first);
  input.emit({type: InputType.TAP_RIGHT});

  assert.equal(engine.currentState, second);
  assert.equal(assets.hasAsset(second.assets[0]!), true);
  assert.ok(calls.includes("activate:world"));
  assert.ok(calls.includes("play:ambience"));
  assert.ok(calls.includes("stop:ambience"));
  assert.ok(calls.includes("play:turn"));
  assert.ok(calls.includes("deactivate:world"));
  assert.ok(calls.indexOf("stop:ambience") < calls.indexOf("play:turn"));

  unbind();
  input.emit({type: InputType.TAP_LEFT});
  assert.equal(engine.currentState, second);
});

test("project repository validates and round-trips project and progress", async () => {
  const {project, first, second} = createProject();
  const storage = new MemoryTextStorage();
  const repository = new ProjectRepository(storage);
  const engine = new Engine(
    second, [first, second], new AudioStack(),
    1, 2, new DeterministicClock()
  );
  const snapshot = createProgressSnapshot(engine, project.story, "build-1");

  await repository.saveProject("story", project);
  await repository.saveProgress("story", snapshot, project.story, "build-1");
  const loaded = await repository.loadProject("story");
  assert.equal(loaded?.story.chapters[0]?.states[0]?.prompts[0]
    ?.transition.triggeredAudioCues[0]?.id, "turn");
  assert.deepEqual(
    await repository.loadProgress("story", project.story, "build-1"),
    snapshot
  );
  assert.equal(await repository.loadProject("missing"), undefined);

  await storage.write("project:broken", "not json");
  await assert.rejects(repository.loadProject("broken"));
  await assert.rejects(repository.loadProgress(
    "story", project.story, "different-build"
  ));

  first.dialogue = "";
  await assert.rejects(repository.saveProject("story", project));
  assert.equal((await repository.loadProject("story"))?.story.title, "Adapters");
});
