import { Story } from "./story.js";

import { Chapter } from "./chapter.js";

import { Panel } from "./panel.js";

import { AudioCue } from "./audioCue.js";

const story = new Story("The Forest of Onekus", "Jaiden McNamara");

const chapter1 = new Chapter("The Boy in the Tree");

const panel1 = new Panel(

  "forest_canopy.png",

  "Onekus stared curiously at the unconscious boy."

);

const forestAmbience = new AudioCue(

  "forest_ambience.mp3",

  "ambience",

  true

);

const punchSound = new AudioCue(

  "punch.wav",

  "soundEffect",

  false

);

panel1.addAudioCue(forestAmbience);

panel1.addAudioCue(punchSound);

chapter1.addPanel(panel1);

story.addChapter(chapter1);

story.describe();

console.log(

  `First panel has ${panel1.audioCues.length} audio cues.`

);