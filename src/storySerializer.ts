import { Story } from "./story.js";

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
}