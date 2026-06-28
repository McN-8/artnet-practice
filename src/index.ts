import { Story } from "./story";

import { Chapter } from "./chapter";

const story = new Story("The Forest of Onekus", "Jaiden McNamara");

const chapter1 = new Chapter("The Boy in the Tree");

const chapter2 = new Chapter("The Promise");

story.addChapter(chapter1);

story.addChapter(chapter2);

story.describe();