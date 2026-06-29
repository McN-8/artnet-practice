import { Story } from "./story.js";

import { Chapter } from "./chapter.js";

import { State } from "./state.js";

import { AudioCue } from "./audioCue.js";

import { Prompt } from "./prompt.js";

import { Effect } from "./effect.js";

import { InputType } from "./inputType.js";

import { Transition } from "./transition.js";

const story = new Story("The Forest of Onekus", "Jaiden McNamara");

const chapter1 = new Chapter("The Boy in the Tree");

const state1 = new State(

  "state-1",

  "forest_canopy.png",

  "Onekus stared curiously at the unconscious boy."

);

const state2 = new State(

  "state-2",

  "extended_branch.png",

  "A branch slowly lowered a piece of fruit toward him.",

  true,

  true

);

const forestAmbience = new AudioCue(

  "forest_ambience.mp3",

  "ambience",

  true,

  0.8,

  "onEnterState"

);

const punchSound = new AudioCue(

  "punch.wav",

  "soundEffect",

  false,

  1.0,

  "onPrompt"

);

const leafDrift = new Effect(

  "floatingLeaves",

  "onEnterState",

  5000

);

const zoomTransition = new Transition(

  "state-2",

  "zoomInspect",

  300

);

const inspectDetail = new Prompt(

  InputType.PINCH_ZOOM,

  zoomTransition

);

const forwardTransition = new Transition(

  "state-2",

  "fadeIn",

  800

);

forwardTransition.addTriggeredAudioCue(punchSound);

const goForward = new Prompt(

  InputType.TAP_RIGHT,

  forwardTransition

);

const backwardTransition = new Transition(

  "state-1",

  "fadeOut",

  500

);

const goBackward = new Prompt(

  InputType.TAP_LEFT,

  backwardTransition

);

state1.addAudioCue(forestAmbience);

state1.addEffect(leafDrift);

state1.addPrompt(goForward);

state2.addPrompt(goBackward);

state2.addPrompt(inspectDetail);

chapter1.addState(state1);

chapter1.addState(state2);

story.addChapter(chapter1);

story.describe();

console.log(

  `${state1.id} has ${state1.prompts.length} prompt.`

);

console.log(

  `${state2.id} has ${state2.prompts.length} prompt.`

);

console.log(

  `${state1.id} has ${state1.effects.length} effect.`

);

console.log(

  `${state2.id} zoom enabled: ${state2.zoomEnabled}, interactive: ${state2.zoomInteractive}.`

);

console.log(

  `Forward transition has ${forwardTransition.triggeredAudioCues.length} triggered audio cue.`

);