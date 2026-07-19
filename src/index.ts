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
import { TransitionEffect } from "./transitionEffect.js";
import { Timeline } from "./timeline.js";
import { TimelineEvent } from "./timelineEvent.js";
import { OverlayAsset } from "./overlayAsset.js";
import { PanelGroup } from "./panelGroup.js";
import { PanelReveal } from "./panelReveal.js";
import { StorySerializer } from "./storySerializer.js";
import { ArtNetResources } from "./artNetResources.js";

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
  "forest-ambience",
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
  "punch-sound",
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
const leafDrift = new Effect(
  "leaf-drift",
  "floatingLeaves",
  "onEnterState",
  5000
);

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

// Panel Groups
const forestOpening = new PanelGroup("forest-opening");

forestOpening.addReveal(
  new PanelReveal(
    "panel-2",
    0,
    0,
    0,
    800,
    450,
    0
  )
);

forestOpening.addReveal(
  new PanelReveal(
    "panel-4",
    1000,
    850,
    100,
    350,
    250,
    -5
  )
);

forestOpening.addReveal(
  new PanelReveal(
    "panel-3",
    1800,
    300,
    520,
    700,
    350,
    0
  )
);

// Overlay
const onekusJumpOverlay = new OverlayAsset(
  "onekus-jump",
  "onekus_jump_sticker.png",
  "canopy-to-boy",
  15,
  800,
  true
);

// Timeline
const forestTimeline = new Timeline();

forestTimeline.addEvent(
  new TimelineEvent(
    500,
    "panelGroup",
    forestOpening
  )
);

forestTimeline.addEvent(
  new TimelineEvent(
    1000,
    "camera",
    canopyToBoyPath
  )
);

forestTimeline.addEvent(
  new TimelineEvent(
    2500,
    "effect",
    leafDrift
  )
);

forestTimeline.addEvent(
  new TimelineEvent(
    3500,
    "audio",
    forestAmbience
  )
);

forestTimeline.addEvent(
  new TimelineEvent(
    4500,
    "overlay",
    onekusJumpOverlay
  )
);

// Resources
const resources = new ArtNetResources();

resources.effects.register(leafDrift);
resources.audio.register(forestAmbience);
resources.audio.register(punchSound);
resources.overlays.register(onekusJumpOverlay);
resources.cameraPaths.register(canopyToBoyPath);
resources.panelGroups.register(forestOpening);


// Transitions and prompts
const zoomEffect = new TransitionEffect(
  "zoomInspect",
  300
);

const zoomTransition = new Transition(
  "state-2",
  zoomEffect
);

const inspectDetail = new Prompt(InputType.PINCH_ZOOM, zoomTransition, "clipboard-clue");

const fadeEffect = new TransitionEffect(
  "fadeIn",
  800,
  true,
  false
);

const forwardTransition = new Transition(
  "state-2",
  fadeEffect
);

forwardTransition.addTriggeredAudioCue(punchSound);

const goForward = new Prompt(InputType.TAP_RIGHT, forwardTransition);

const fadeOutEffect = new TransitionEffect(
  "fadeOut",
  500
);

const backwardTransition = new Transition(
  "state-1",
  fadeOutEffect
);

const goBackward = new Prompt(InputType.TAP_LEFT, backwardTransition);

// Connect state 1
state1.addAudioCue(forestAmbience);
state1.addEffect(leafDrift);
state1.setTimeline(forestTimeline);
state1.addPrompt(goForward);
state1.addCameraBehavior(canopyPan);
state1.addCameraFocalPoint(onekusFocus);
state1.addCameraFocalPoint(boyFocus);
state1.addCameraPath(canopyToBoyPath);
state1.addCameraEvent(revealBoyEvent);
state1.activateAudioLayer("forest_base");
state1.addPanelGroup(forestOpening);

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
const engine = new Engine(state1, [state1, state2], audioStack);

// Diagnostics
story.describe();

console.log(`${state1.id} has ${state1.prompts.length} prompt.`);
console.log(`${state2.id} has ${state2.prompts.length} prompt.`);
console.log(`${state1.id} timeline events: ${state1.timeline.events.length}`);
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
console.log(`${state1.id} has ${state1.panelGroups.length} panel group.`);
console.log(`Forest opening has ${forestOpening.reveals.length} reveals.`);
console.log(
  `Camera path speed multiplier: ${canopyToBoyPath.speedMultiplier}`
);
console.log(`Audio stack has ${audioStack.layers.length} layer.`);

// Resource Registry Diagnostics
console.log(
  `Registered effects: ${resources.effects.getAll().length}`
);

console.log(
  `Registered audio cues: ${resources.audio.getAll().length}`
);

console.log(
  `Registered overlays: ${resources.overlays.getAll().length}`
);

console.log(
  `Registered camera paths: ${resources.cameraPaths.getAll().length}`
);

console.log(
  `Registered panel groups: ${resources.panelGroups.getAll().length}`
);

// Serializer Test
const storyJSON = StorySerializer.toJSON(
  story,
  resources
);

const project = StorySerializer.fromJSON(storyJSON);

const loadedStory = project.story;
const loadedResources = project.resources;

const loadedState1 =
  loadedStory.chapters[0]?.states[0];

console.log(
  `Loaded state-1 effects: ${
    loadedState1?.effects.length ?? 0
  }`
);

console.log(
  `Loaded state-1 audio cues: ${
    loadedState1?.audioCues.length ?? 0
  }`
);

console.log(
    `Loaded resource library created: ${
        loadedResources instanceof ArtNetResources
    }`
);

console.log(
  `Loaded effects: ${loadedResources.effects.getAll().length}`
);

const loadedLeafDrift =
  loadedResources.effects.get("leaf-drift");

console.log(
  `Loaded effect: ${loadedLeafDrift?.id}, type: ${loadedLeafDrift?.type}`
);

console.log(
  `Loaded audio cues: ${loadedResources.audio.getAll().length}`
);

const loadedForestAmbience =
  loadedResources.audio.get("forest-ambience");

console.log(
  `Loaded audio: ${loadedForestAmbience?.id}, layer: ${loadedForestAmbience?.layerGroup}`
);

console.log(
  `Loaded camera paths: ${
    loadedResources.cameraPaths.getAll().length
  }`
);

const loadedCanopyPath =
  loadedResources.cameraPaths.get("canopy-to-boy");

console.log(
  `Loaded camera path: ${loadedCanopyPath?.id}, duration: ${loadedCanopyPath?.duration}`
);

console.log(
  `Loaded path start: ${loadedCanopyPath?.startPoint.id}`
);

console.log(
  `Loaded overlays: ${
    loadedResources.overlays.getAll().length
  }`
);

const loadedOverlay =
  loadedResources.overlays.get("onekus-jump");

console.log(
  `Loaded overlay: ${loadedOverlay?.id}, asset: ${loadedOverlay?.asset}`
);

console.log(
  `Loaded panel groups: ${
    loadedResources.panelGroups.getAll().length
  }`
);

const loadedForestOpening =
  loadedResources.panelGroups.get("forest-opening");

console.log(
  `Loaded panel group: ${loadedForestOpening?.id}`
);

console.log(
  `Reveals in group: ${
    loadedForestOpening?.reveals.length
  }`
);

console.log(
  `Loaded story: ${loadedStory.title} by ${loadedStory.creator}`
);

console.log(
  `Loaded chapters: ${loadedStory.chapters.length}`
);
console.log(
  `Loaded states: ${loadedStory.chapters[0]?.states.length}`
);

console.log("Serialized story:");
console.log(storyJSON);

// Runtime test
console.log(`Current state is ${engine.currentState.id}`);

engine.startState(state1);

const currentStateIndex = engine.getCurrentStateIndex();

engine.preloadNearbyStates(currentStateIndex);
engine.unloadDistantStateAssets(currentStateIndex);

engine.handleInput(InputType.TAP_RIGHT);

// Timer Test ; (Keep commented out until testing is needed.)
// engine.playPanelGroup(forestOpening);