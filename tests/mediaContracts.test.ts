import assert from "node:assert/strict";
import test from "node:test";
import { ArtNetResources } from "../src/artNetResources.js";
import { AudioCue } from "../src/audioCue.js";
import { AudioStack } from "../src/audioStack.js";
import { Chapter } from "../src/chapter.js";
import { DeterministicClock } from "../src/clock.js";
import { Engine } from "../src/engine.js";
import {
  AnimationSequence, HapticPattern, MotionPath, ParticleEffect,
  sampleParticleSpawns
} from "../src/mediaContracts.js";
import type { MediaAdapter } from "../src/mediaContracts.js";
import { Panel } from "../src/panel.js";
import { ProjectValidationError, validateProjectDocument } from
  "../src/projectValidation.js";
import { State } from "../src/state.js";
import { Story } from "../src/story.js";
import { StorySerializer } from "../src/storySerializer.js";
import { TimelineEvent } from "../src/timelineEvent.js";

function project() {
  const story = new Story("Effects", "ArtNet");
  const chapter = new Chapter("First");
  const state = new State("only", "page.png", "A storm approaches.");
  state.isEnding = true;
  chapter.addState(state);
  story.addChapter(chapter);
  const resources = new ArtNetResources();
  resources.panels.register(new Panel("spark", "spark.png", "A spark"));
  resources.panels.register(new Panel("still", "still.png", "A still spark"));
  resources.audio.register(new AudioCue(
    "crack", "crack.wav", "soundEffect", false, 1,
    "timeline", false, 0, 0, "effects"
  ));
  const animation = new AnimationSequence(
    "flash", "explosion", 100,
    [{ atMs: 0, panelId: "spark" }],
    [{ atMs: 25, audioCueId: "crack" }], "still"
  );
  const path = new MotionPath("zigzag", 100, [
    { atMs: 0, x: 0, y: 0 },
    { atMs: 100, x: 1, y: 1 }
  ]);
  const particles = new ParticleEffect(
    "burst", "explosion", 42, "circle", 0.5, 0.5, 0.1,
    -90, 180, 10, 100, 20, 0.25, 0.5, 1.5, 90,
    [{ panelId: "spark", weight: 1 }], "stopAtCanvas", "still", "zigzag"
  );
  const haptics = new HapticPattern(
    "thunder", 200,
    [{ atMs: 0, durationMs: 50, intensity: 0.8 }],
    "The ground shakes."
  );
  resources.animationSequences.register(animation);
  resources.motionPaths.register(path);
  resources.particleEffects.register(particles);
  resources.hapticPatterns.register(haptics);
  state.timeline.addEvent(new TimelineEvent(10, "animation", animation));
  state.timeline.addEvent(new TimelineEvent(20, "particles", particles));
  state.timeline.addEvent(new TimelineEvent(30, "haptic", haptics));
  return { story, resources, state, animation, particles, haptics };
}

test("media resource IDs round trip to typed timeline payloads", () => {
  const { story, resources } = project();
  const json = StorySerializer.toJSON(story, resources);
  const document = JSON.parse(json);
  assert.deepEqual(
    document.chapters[0].states[0].timeline.events.map(
      (event: { payloadId: string }) => event.payloadId
    ), ["flash", "burst", "thunder"]
  );
  const loaded = StorySerializer.fromJSON(json);
  const events = loaded.story.chapters[0]!.states[0]!.timeline.events;
  assert.ok(events[0]!.payload instanceof AnimationSequence);
  assert.ok(events[1]!.payload instanceof ParticleEffect);
  assert.ok(events[2]!.payload instanceof HapticPattern);
  assert.equal(events[1]!.payload,
    loaded.resources.particleEffects.get("burst"));
  assert.ok(loaded.resources.motionPaths.get("zigzag") instanceof MotionPath);
});

test("particle sampling is seeded, bounded, and supports manual path identity", () => {
  const { particles } = project();
  const first = sampleParticleSpawns(particles);
  assert.deepEqual(first, sampleParticleSpawns(particles));
  assert.equal(first.length, 10);
  assert.ok(first.every((spawn) =>
    spawn.angleDegrees >= -180 && spawn.angleDegrees <= 0 &&
    spawn.motionPathId === "zigzag"
  ));
  const different = new ParticleEffect(
    particles.id, particles.category, 43, particles.emitterShape,
    particles.originX, particles.originY, particles.radius,
    particles.directionDegrees, particles.coneDegrees, particles.count,
    particles.lifetimeMs, particles.speed, particles.speedVariation,
    particles.scaleMin, particles.scaleMax,
    particles.rotationVariationDegrees, particles.visuals,
    particles.boundsPolicy, particles.reducedMotionPanelId,
    particles.motionPathId
  );
  assert.notDeepEqual(first, sampleParticleSpawns(different));

  different.motionPathIds = Array.from({length: different.count},
    (_, index) => index % 2 === 0 ? "zigzag" : "alternate");
  const individuallyAuthored = sampleParticleSpawns(different);
  assert.equal(individuallyAuthored[0]?.motionPathId, "zigzag");
  assert.equal(individuallyAuthored[1]?.motionPathId, "alternate");
});

test("media validation reports nested ranges and missing IDs", () => {
  const { story, resources } = project();
  const document = JSON.parse(StorySerializer.toJSON(story, resources));
  document.resources.particleEffects[0].count = 501;
  document.resources.hapticPatterns[0].pulses[0].intensity = 2;
  assert.throws(() => validateProjectDocument(document), (error: unknown) => {
    assert.ok(error instanceof ProjectValidationError);
    assert.ok(error.issues.some((issue) =>
      issue.path === "$.resources.particleEffects[0].count"));
    assert.ok(error.issues.some((issue) =>
      issue.path === "$.resources.hapticPatterns[0].pulses[0].intensity"));
    return true;
  });
  document.resources.particleEffects[0].count = 10;
  document.resources.hapticPatterns[0].pulses[0].intensity = 0.8;
  document.resources.particleEffects[0].motionPathId = "missing";
  document.resources.animationSequences[0].audioClips[0].audioCueId = "missing";
  assert.throws(() => validateProjectDocument(document), (error: unknown) => {
    assert.ok(error instanceof ProjectValidationError);
    assert.ok(error.issues.some((issue) =>
      issue.path === "$.resources.particleEffects[0].motionPathId"));
    assert.ok(error.issues.some((issue) =>
      issue.path ===
      "$.resources.animationSequences[0].audioClips[0].audioCueId"));
    return true;
  });
});

test("runtime dispatch honors capabilities, alternatives, and cancellation", () => {
  const { state } = project();
  const clock = new DeterministicClock();
  const calls: string[] = [];
  const adapter: MediaAdapter = {
    capabilities: {
      animation: true, particles: true, haptics: false,
      reducedMotion: false, hapticsEnabled: false
    },
    playAnimation: (value) => calls.push(`animation:${value.id}`),
    playParticles: (value) => calls.push(`particles:${value.id}`),
    playHaptics: (value) => calls.push(`haptic:${value.id}`),
    showReducedMotionPanel: (id) => calls.push(`still:${id}`),
    showHapticAlternative: (text) => calls.push(`text:${text}`),
    cancelAll: () => calls.push("cancel")
  };
  const engine = new Engine(
    state, [state], new AudioStack(), 1, 2, clock,
    undefined, undefined, undefined, undefined, adapter
  );
  engine.startState(state);
  clock.advanceBy(30);
  assert.deepEqual(calls, [
    "cancel", "animation:flash", "particles:burst", "text:The ground shakes."
  ]);
  engine.startState(state);
  engine.clearActiveTimers();
  clock.advanceBy(30);
  assert.deepEqual(calls.slice(-2), ["cancel", "cancel"]);
});

test("reduced motion uses still panels while permitted haptics retain text", () => {
  const { state } = project();
  const clock = new DeterministicClock();
  const calls: string[] = [];
  const adapter: MediaAdapter = {
    capabilities: {
      animation: true, particles: true, haptics: true,
      reducedMotion: true, hapticsEnabled: true
    },
    playAnimation: () => calls.push("animation"),
    playParticles: () => calls.push("particles"),
    playHaptics: (value) => calls.push(`haptic:${value.id}`),
    showReducedMotionPanel: (id) => calls.push(`still:${id}`),
    showHapticAlternative: (text) => calls.push(`text:${text}`),
    cancelAll: () => {}
  };
  const engine = new Engine(
    state, [state], new AudioStack(), 1, 2, clock,
    undefined,
    {reducedMotion: true, captionsEnabled: true,
      audioDescriptionsEnabled: false},
    undefined, undefined, adapter
  );
  engine.startState(state);
  clock.advanceBy(30);
  assert.deepEqual(calls, [
    "still:still", "still:still", "text:The ground shakes.",
    "haptic:thunder"
  ]);
});

test("older version-1 projects default the new registries to empty", () => {
  const { story, resources } = project();
  const document = JSON.parse(StorySerializer.toJSON(story, resources));
  for (const collection of [
    "animationSequences", "motionPaths", "particleEffects", "hapticPatterns"
  ]) delete document.resources[collection];
  document.chapters[0].states[0].timeline.events = [];
  const loaded = StorySerializer.fromJSON(JSON.stringify(document));
  assert.equal(loaded.resources.particleEffects.getAll().length, 0);
  assert.equal(loaded.resources.hapticPatterns.getAll().length, 0);
});
