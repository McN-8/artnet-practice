import { Story } from "./story.js";
import { Chapter } from "./chapter.js";
import { State } from "./state.js";
import { AudioCue } from "./audioCue.js";
import { Prompt } from "./prompt.js";
import { Effect } from "./effect.js";
import { InputType } from "./inputType.js";
import { Transition } from "./transition.js";
import { Engine } from "./engine.js";
import { ZoomRegion } from "./zoomRegion.js";
import { Asset } from "./asset.js";
import { CameraBehavior } from "./cameraBehavior.js";
import { CameraFocalPoint } from "./cameraFocalPoint.js";
import { CameraPath } from "./cameraPath.js";
import { CameraEvent } from "./cameraEvent.js";
import { AudioLayer } from "./audioLayer.js";
import { AudioStack } from "./audioStack.js";

// Story setup
const story = new Story("The Forest of Onekus", "Jaiden McNamara");
const chapter1 = new Chapter("The Boy in the Tree");

// State setup
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

// Assets
const state2Image = new Asset("extended_branch.png", "image");
const state2Ambience = new Asset("forest_ambience.mp3", "audio");

// Audio
const forestAmbience = new AudioCue(
  "forest_ambience.mp3",
  "ambience",
  true,
  0.8,
  "onEnterState",
  true,
  1000,
  1000,
  "forest"
);

const punchSound = new AudioCue(
  "punch.wav",
  "soundEffect",
  false,
  1.0,
  "onPrompt",
  false,
  0,
  0,
  "impact"
);

const forestBaseLayer = new AudioLayer("forest_base", forestAmbience);
const audioStack = new AudioStack();
audioStack.addLayer(forestBaseLayer);

// Effects
const leafDrift = new Effect("floatingLeaves", "onEnterState", 5000);

// Zoom
const hiddenClipboardText = new ZoomRegion(
  "clipboard-clue",
  120,
  80,
  200,
  100,
  "Small text on the clipboard reads: Project Temple 01."
);

// Camera
const canopyPan = new CameraBehavior("slowPanDown", 3000);

const onekusFocus = new CameraFocalPoint("onekus-canopy", 400, 150, 1.5);
const boyFocus = new CameraFocalPoint("unconscious-boy", 700, 420, 1.8);

const canopyToBoyPath = new CameraPath(
  "canopy-to-boy",
  onekusFocus,
  boyFocus,
  3000,
  "easeInOut",
  1.0
);

const revealBoyEvent = new CameraEvent(1500, canopyToBoyPath);

// Transitions and prompts
const zoomTransition = new Transition("state-2", "zoomInspect", 300);
const inspectDetail = new Prompt(InputType.PINCH_ZOOM, zoomTransition);

const forwardTransition = new Transition("state-2", "fadeIn", 800);
forwardTransition.addTriggeredAudioCue(punchSound);

const goForward = new Prompt(InputType.TAP_RIGHT, forwardTransition);

const backwardTransition = new Transition("state-1", "fadeOut", 500);
const goBackward = new Prompt(InputType.TAP_LEFT, backwardTransition);

// Connect state 1
state1.addAudioCue(forestAmbience);
state1.addEffect(leafDrift);
state1.addPrompt(goForward);
// state1.enableAutoAdvance(2000, goForward);
state1.addCameraBehavior(canopyPan);
state1.addCameraFocalPoint(onekusFocus);
state1.addCameraFocalPoint(boyFocus);
state1.addCameraPath(canopyToBoyPath);
state1.addCameraEvent(revealBoyEvent);

// Connect state 2
state2.addAsset(state2Image);
state2.addAsset(state2Ambience);
state2.addZoomRegion(hiddenClipboardText);
state2.addPrompt(goBackward);
state2.addPrompt(inspectDetail);

// Connect story structure
chapter1.addState(state1);
chapter1.addState(state2);
story.addChapter(chapter1);

// Engine setup
const engine = new Engine(state1, [state1, state2]);

// Diagnostics
story.describe();

console.log(`${state1.id} has ${state1.prompts.length} prompt.`);
console.log(`${state2.id} has ${state2.prompts.length} prompt.`);
console.log(`${state1.id} has ${state1.effects.length} effect.`);
console.log(
  `${state2.id} zoom enabled: ${state2.zoomEnabled}, interactive: ${state2.zoomInteractive}.`
);
console.log(
  `Forward transition has ${forwardTransition.triggeredAudioCues.length} triggered audio cue.`
);
console.log(`${state2.id} has ${state2.zoomRegions.length} zoom region.`);
console.log(`Forest ambience belongs to layer group: ${forestAmbience.layerGroup}`);
console.log(`${state1.id} has ${state1.cameraBehaviors.length} camera behavior.`);
console.log(`${state1.id} has ${state1.cameraFocalPoints.length} camera focal point.`);
console.log(`${state1.id} has ${state1.cameraPaths.length} camera path.`);
console.log(`${state1.id} has ${state1.cameraEvents.length} camera event.`);
console.log(
  `Camera path speed multiplier: ${canopyToBoyPath.speedMultiplier}`
);
console.log(`Audio stack has ${audioStack.layers.length} layer.`);

// Runtime test
console.log(`Current state is ${engine.currentState.id}`);

audioStack.activateLayer("forest_base");

engine.preloadNearbyStates(0);
engine.unloadDistantStateAssets(0);

engine.executePrompt(goForward);