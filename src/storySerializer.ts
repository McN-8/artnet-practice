import { Story } from "./story.js";
import { Chapter } from "./chapter.js";
import { State } from "./state.js";

export class StorySerializer {
  static toJSON(story: Story): string {
    const exportData = {
      title: story.title,
      creator: story.creator,
      chapters: story.chapters.map((chapter) => ({
        title: chapter.title,
        states: chapter.states.map((state) => ({
          id: state.id,
          image: state.image,
          dialogue: state.dialogue,
          zoomEnabled: state.zoomEnabled,
          zoomInteractive: state.zoomInteractive,
          zoomRegions: state.zoomRegions,
          audioCues: state.audioCues,
          audioLayersToActivate: state.audioLayersToActivate,
          audioLayersToDeactivate: state.audioLayersToDeactivate,
          prompts: state.prompts,
          effects: state.effects,
          assets: state.assets,
          cameraBehaviors: state.cameraBehaviors,
          cameraFocalPoints: state.cameraFocalPoints,
          cameraPaths: state.cameraPaths,
          cameraEvents: state.cameraEvents,
          panelGroups: state.panelGroups,
          timeline: {
            events: state.timeline.events.map((event) => ({
              timestamp: event.timestamp,
              type: event.type,
              payloadId:
                typeof event.payload === "object" &&
                event.payload !== null &&
                "id" in event.payload
                  ? event.payload.id
                  : undefined
            }))
          },
          autoAdvanceEnabled: state.autoAdvanceEnabled,
          autoAdvanceDelay: state.autoAdvanceDelay,
          fastForwardEnabled: state.fastForwardEnabled,
          fastForwardMultiplier: state.fastForwardMultiplier
        }))
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

 static fromJSON(json: string): Story {
  const data = JSON.parse(json);

  const story = new Story(
    data.title,
    data.creator
  );

  for (const chapterData of data.chapters) {
  const chapter = new Chapter(chapterData.title);

  for (const stateData of chapterData.states) {
    const state = new State(
      stateData.id,
      stateData.image,
      stateData.dialogue,
      stateData.zoomEnabled,
      stateData.zoomInteractive
    );

    chapter.addState(state);
  }

  story.addChapter(chapter);
  }

  return story;
}
}