import { Story } from "./story";

import { Chapter } from "./chapter";

import { Panel } from "./panel";

const story = new Story(

  "The Forest of Onekus",

  "Jaiden McNamara"

);

const chapter1 = new Chapter(

  "The Boy in the Tree"

);

const panel1 = new Panel(

  "forest_canopy.png",

  "Onekus stared curiously at the unconscious boy."

);

chapter1.addPanel(panel1);

story.addChapter(chapter1);

story.describe();

console.log(

  `First chapter contains ${chapter1.panels.length} panel.`

);