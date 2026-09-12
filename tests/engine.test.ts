import assert from "node:assert/strict";
import test from "node:test";
import { AudioStack } from "../src/audioStack.js";
import { DeterministicClock } from "../src/clock.js";
import { Effect } from "../src/effect.js";
import { Engine } from "../src/engine.js";
import { InputType } from "../src/inputType.js";
import { PanelGroup } from "../src/panelGroup.js";
import { PanelReveal } from "../src/panelReveal.js";
import { Panel } from "../src/panel.js";
import { Prompt } from "../src/prompt.js";
import { State } from "../src/state.js";
import { TimelineEvent } from "../src/timelineEvent.js";
import { Transition } from "../src/transition.js";
import { TransitionEffect } from "../src/transitionEffect.js";
import type { Renderer } from "../src/renderer.js";
import {
  ARTNET_COORDINATE_SYSTEM,
  VISUAL_LAYER_ORDER
} from "../src/visualContract.js";

function createEngine(
  state: State,
  states: State[],
  clock: DeterministicClock
): Engine {
  return new Engine(
    state,
    states,
    new AudioStack(),
    1,
    2,
    clock
  );
}

function createPrompt(destinationStateId: string): Prompt {
  return new Prompt(
    InputType.TAP_RIGHT,
    new Transition(
      destinationStateId,
      new TransitionEffect("none", 0)
    )
  );
}

test("deterministic clock advances tasks in stable due-time order", () => {
  const clock = new DeterministicClock();
  const fired: string[] = [];
  const cancelled = clock.setTimeout(
    () => fired.push("cancelled"),
    5
  );

  clock.setTimeout(() => fired.push("second"), 20);
  clock.setTimeout(() => fired.push("first"), 10);
  clock.setTimeout(() => fired.push("third"), 20);
  clock.clearTimeout(cancelled);

  clock.advanceBy(19);
  assert.deepEqual(fired, ["first"]);
  assert.equal(clock.now, 19);

  clock.advanceBy(1);
  assert.deepEqual(fired, ["first", "second", "third"]);
  assert.equal(clock.pendingTimerCount, 0);
});

test("timeline events fire only after deterministic advancement", () => {
  const clock = new DeterministicClock();
  const state = new State("one", "one.png", "One");
  const effect = new Effect("glow", "glow", "timeline", 50);
  const fired: string[] = [];

  state.timeline.addEvent(
    new TimelineEvent(100, "effect", effect)
  );

  const engine = createEngine(state, [state], clock);
  engine.runEffect = (value) => fired.push(value.type);
  engine.startState(state);

  clock.advanceBy(99);
  assert.deepEqual(fired, []);

  clock.advanceBy(1);
  assert.deepEqual(fired, ["glow"]);
  assert.equal(engine.activeTimers.length, 0);
});

test("starting another state cancels abandoned timeline timers", () => {
  const clock = new DeterministicClock();
  const first = new State("one", "one.png", "One");
  const second = new State("two", "two.png", "Two");
  const fired: string[] = [];

  first.timeline.addEvent(
    new TimelineEvent(
      100,
      "effect",
      new Effect("late", "late", "timeline", 10)
    )
  );

  const engine = createEngine(first, [first, second], clock);
  engine.runEffect = (value) => fired.push(value.type);
  engine.startState(first);
  engine.startState(second);
  clock.advanceBy(100);

  assert.deepEqual(fired, []);
  assert.equal(clock.pendingTimerCount, 0);
});

test("auto-advance runs through the deterministic clock", () => {
  const clock = new DeterministicClock();
  const first = new State("one", "one.png", "One");
  const second = new State("two", "two.png", "Two");

  first.enableAutoAdvance(100, createPrompt("two"));

  const engine = createEngine(first, [first, second], clock);
  engine.startState(first);

  clock.advanceBy(99);
  assert.equal(engine.currentState, first);

  clock.advanceBy(1);
  assert.equal(engine.currentState, second);
  assert.equal(clock.pendingTimerCount, 0);
});

test("clearing timers cancels a pending auto-advance", () => {
  const clock = new DeterministicClock();
  const first = new State("one", "one.png", "One");
  const second = new State("two", "two.png", "Two");

  first.enableAutoAdvance(100, createPrompt("two"));

  const engine = createEngine(first, [first, second], clock);
  engine.startState(first);
  engine.clearActiveTimers();
  clock.advanceBy(100);

  assert.equal(engine.currentState, first);
  assert.equal(clock.pendingTimerCount, 0);
});

test("fast-forward scales eligible timeline and auto-advance delays", () => {
  const clock = new DeterministicClock();
  const first = new State("one", "one.png", "One");
  const second = new State("two", "two.png", "Two");
  const fired: string[] = [];

  first.fastForwardMultiplier = 4;
  first.timeline.addEvent(
    new TimelineEvent(
      80,
      "effect",
      new Effect("early", "early", "timeline", 10)
    )
  );
  first.enableAutoAdvance(100, createPrompt("two"));

  const engine = createEngine(first, [first, second], clock);
  engine.runEffect = (value) => fired.push(value.type);
  engine.enableFastForward();
  engine.startState(first);

  clock.advanceBy(19);
  assert.deepEqual(fired, []);
  assert.equal(engine.currentState, first);

  clock.advanceBy(1);
  assert.deepEqual(fired, ["early"]);

  clock.advanceBy(5);
  assert.equal(engine.currentState, second);
});

test("state configuration can opt out of fast-forward timing", () => {
  const clock = new DeterministicClock();
  const state = new State("one", "one.png", "One");
  const fired: string[] = [];

  state.fastForwardEnabled = false;
  state.fastForwardMultiplier = 4;
  state.timeline.addEvent(
    new TimelineEvent(
      80,
      "effect",
      new Effect("normal", "normal", "timeline", 10)
    )
  );

  const engine = createEngine(state, [state], clock);
  engine.runEffect = (value) => fired.push(value.type);
  engine.enableFastForward();
  engine.startState(state);

  clock.advanceBy(79);
  assert.deepEqual(fired, []);
  clock.advanceBy(1);
  assert.deepEqual(fired, ["normal"]);
});

test("fast-forward scales panel reveal delays", () => {
  const clock = new DeterministicClock();
  const state = new State("one", "one.png", "One");
  const panels = new PanelGroup("panels");

  state.fastForwardMultiplier = 2;
  panels.addReveal(
    new PanelReveal(new Panel("panel-1"), 100)
  );

  const engine = createEngine(state, [state], clock);
  engine.enableFastForward();
  engine.playPanelGroup(panels);

  clock.advanceBy(49);
  assert.equal(clock.pendingTimerCount, 1);
  clock.advanceBy(1);
  assert.equal(clock.pendingTimerCount, 0);
  assert.equal(engine.activeTimers.length, 0);
});

test("visual contract fixes coordinates and layer ordering", () => {
  assert.deepEqual(ARTNET_COORDINATE_SYSTEM, {
    width: 1600,
    height: 900,
    origin: "topLeft",
    xDirection: "right",
    yDirection: "down",
    units: "logicalPixels",
    scaling: "uniformContain"
  });
  assert.deepEqual(VISUAL_LAYER_ORDER, [
    "background",
    "panels",
    "overlays",
    "effects",
    "dialogue",
    "interaction"
  ]);
  assert.equal(Object.isFrozen(ARTNET_COORDINATE_SYSTEM), true);
  assert.equal(Object.isFrozen(VISUAL_LAYER_ORDER), true);
});

test("engine delegates state and panel rendering through Renderer", () => {
  const clock = new DeterministicClock();
  const state = new State("one", "one.png", "One");
  const panel = new Panel("panel-1");
  const panels = new PanelGroup("panels");
  const calls: string[] = [];
  const renderer: Renderer = {
    renderState(renderedState, context) {
      calls.push(`${renderedState.id}:${context.layerOrder[0]}`);
    },
    revealPanel(reveal, context) {
      calls.push(`${reveal.panel.id}:${context.coordinateSystem.width}`);
    },
    runCameraPath() {},
    runEffect() {},
    displayOverlay() {}
  };

  panels.addReveal(new PanelReveal(panel, 10));

  const engine = new Engine(
    state,
    [state],
    new AudioStack(),
    1,
    2,
    clock,
    renderer
  );

  engine.startState(state);
  engine.playPanelGroup(panels);
  clock.advanceBy(10);

  assert.deepEqual(calls, [
    "one:background",
    "panel-1:1600"
  ]);
});
