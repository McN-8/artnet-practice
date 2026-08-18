import { Story } from "./story.js";
import { Chapter } from "./chapter.js";
import { State } from "./state.js";
import { ArtNetResources } from "./artNetResources.js";
import { ProjectData } from "./projectData.js";
import { Effect } from "./effect.js";
import { AudioCue } from "./audioCue.js";
import { CameraPath } from "./cameraPath.js";
import { CameraFocalPoint } from "./cameraFocalPoint.js";
import { CameraEvent } from "./cameraEvent.js";
import { OverlayAsset } from "./overlayAsset.js";
import { PanelGroup } from "./panelGroup.js";
import { PanelReveal } from "./panelReveal.js";
import { Timeline } from "./timeline.js";
import { TimelineEvent } from "./timelineEvent.js";

export class StorySerializer {
  static toJSON(
    story: Story,
    resources: ArtNetResources
  ): string {
    const exportData = {
      title: story.title,
      creator: story.creator,

      resources: {
        effects: resources.effects.getAll(),
        audio: resources.audio.getAll(),
        overlays: resources.overlays.getAll(),
        cameraPaths: resources.cameraPaths.getAll(),
        panelGroups: resources.panelGroups.getAll()
      },

      chapters: story.chapters.map((chapter) => ({
        title: chapter.title,

        states: chapter.states.map((state) => ({
          id: state.id,
          image: state.image,
          dialogue: state.dialogue,
          zoomEnabled: state.zoomEnabled,
          zoomInteractive: state.zoomInteractive,
          zoomRegions: state.zoomRegions,

          audioCueIds: state.audioCues.map(
            (audioCue) => audioCue.id
          ),

          audioLayersToActivate:
            state.audioLayersToActivate,

          audioLayersToDeactivate:
            state.audioLayersToDeactivate,

          prompts: state.prompts,

          effectIds: state.effects.map(
            (effect) => effect.id
          ),

          assets: state.assets,
          cameraBehaviors: state.cameraBehaviors,
          cameraFocalPoints: state.cameraFocalPoints,

          cameraPathIds: state.cameraPaths.map(
            (cameraPath) => cameraPath.id
          ),

          cameraEvents: state.cameraEvents.map(
            (cameraEvent) => ({
              triggerTime: cameraEvent.triggerTime,
              cameraPathId: cameraEvent.cameraPath.id
            })
          ),

          panelGroupIds: state.panelGroups.map(
            (panelGroup) => panelGroup.id
          ),

          timeline: {
            events: state.timeline.events.map(
              (event) => ({
                timestamp: event.timestamp,
                type: event.type,

                payloadId:
                  typeof event.payload === "object" &&
                  event.payload !== null &&
                  "id" in event.payload
                    ? event.payload.id
                    : undefined
              })
            )
          },

          autoAdvanceEnabled:
            state.autoAdvanceEnabled,

          autoAdvanceDelay:
            state.autoAdvanceDelay,

          fastForwardEnabled:
            state.fastForwardEnabled,

          fastForwardMultiplier:
            state.fastForwardMultiplier
        }))
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  static fromJSON(json: string): ProjectData {
    const data = JSON.parse(json);

    const story = new Story(
      data.title,
      data.creator
    );

    const resources = new ArtNetResources();

    /*
     * Rebuild effects.
     */
    for (const effectData of data.resources.effects) {
      const effect = new Effect(
        effectData.id,
        effectData.type,
        effectData.trigger,
        effectData.duration
      );

      resources.effects.register(effect);
    }

    /*
     * Rebuild audio cues.
     */
    for (const audioData of data.resources.audio) {
      const audio = new AudioCue(
        audioData.id,
        audioData.file,
        audioData.type,
        audioData.loop,
        audioData.volume,
        audioData.trigger,
        audioData.persistsAcrossStates,
        audioData.fadeInDuration,
        audioData.fadeOutDuration,
        audioData.layerGroup
      );

      resources.audio.register(audio);
    }

    /*
     * Rebuild camera paths.
     */
    for (
      const cameraPathData
      of data.resources.cameraPaths
    ) {
      const startPoint = new CameraFocalPoint(
        cameraPathData.startPoint.id,
        cameraPathData.startPoint.x,
        cameraPathData.startPoint.y,
        cameraPathData.startPoint.zoomLevel
      );

      const endPoint = new CameraFocalPoint(
        cameraPathData.endPoint.id,
        cameraPathData.endPoint.x,
        cameraPathData.endPoint.y,
        cameraPathData.endPoint.zoomLevel
      );

      const cameraPath = new CameraPath(
        cameraPathData.id,
        startPoint,
        endPoint,
        cameraPathData.duration,
        cameraPathData.easing,
        cameraPathData.speedMultiplier
      );

      resources.cameraPaths.register(cameraPath);
    }

    /*
     * Rebuild overlays.
     */
    for (
      const overlayData
      of data.resources.overlays
    ) {
      const overlay = new OverlayAsset(
        overlayData.id,
        overlayData.asset,
        overlayData.pathId,
        overlayData.rotation,
        overlayData.duration,
        overlayData.followPath
      );

      resources.overlays.register(overlay);
    }

    /*
     * Rebuild panel groups and their reveals.
     */
    for (
      const panelGroupData
      of data.resources.panelGroups
    ) {
      const panelGroup = new PanelGroup(
        panelGroupData.id
      );

      for (
        const revealData
        of panelGroupData.reveals
      ) {
        const reveal = new PanelReveal(
          revealData.panelId,
          revealData.delay,
          revealData.x,
          revealData.y,
          revealData.width,
          revealData.height,
          revealData.rotation
        );

        panelGroup.addReveal(reveal);
      }

      resources.panelGroups.register(panelGroup);
    }

    /*
     * Rebuild chapters and states.
     */
    for (const chapterData of data.chapters) {
      const chapter = new Chapter(
        chapterData.title
      );

      for (
        const stateData
        of chapterData.states
      ) {
        const state = new State(
          stateData.id,
          stateData.image,
          stateData.dialogue,
          stateData.zoomEnabled,
          stateData.zoomInteractive
        );

        /*
         * Resolve the state's effect references.
         */
        for (
          const effectId
          of stateData.effectIds
        ) {
          const effect =
            resources.effects.get(effectId);

          if (effect) {
            state.addEffect(effect);
          } else {
            console.warn(
              `Missing effect resource: ${effectId}`
            );
          }
        }

        /*
         * Resolve the state's audio references.
         */
        for (
          const audioCueId
          of stateData.audioCueIds
        ) {
          const audioCue =
            resources.audio.get(audioCueId);

          if (audioCue) {
            state.addAudioCue(audioCue);
          } else {
            console.warn(
              `Missing audio resource: ${audioCueId}`
            );
          }
        }

        /*
         * Resolve the state's camera-path references.
         */
        for (
          const cameraPathId
          of stateData.cameraPathIds
        ) {
          const cameraPath =
            resources.cameraPaths.get(
              cameraPathId
            );

          if (cameraPath) {
            state.addCameraPath(cameraPath);
          } else {
            console.warn(
              `Missing camera path resource: ` +
              `${cameraPathId}`
            );
          }
        }

        /*
         * Rebuild camera events from camera-path references.
         */
        for (
          const cameraEventData
          of stateData.cameraEvents
        ) {
          const cameraPath =
            resources.cameraPaths.get(
              cameraEventData.cameraPathId
            );

          if (cameraPath) {
            state.addCameraEvent(
              new CameraEvent(
                cameraEventData.triggerTime,
                cameraPath
              )
            );
          } else {
            console.warn(
              `Missing camera event path resource: ` +
              `${cameraEventData.cameraPathId}`
            );
          }
        }

        /*
         * Resolve the state's panel-group references.
         */
        for (
          const panelGroupId
          of stateData.panelGroupIds
        ) {
          const panelGroup =
            resources.panelGroups.get(
              panelGroupId
            );

          if (panelGroup) {
            state.addPanelGroup(panelGroup);
          } else {
            console.warn(
              `Missing panel group resource: ` +
              `${panelGroupId}`
            );
          }
        }

        /*
         * Rebuild the state's timeline.
         *
         * The JSON stores payload IDs.
         * The runtime TimelineEvent stores real objects.
         */
        const timeline = new Timeline();

        for (
          const eventData
          of stateData.timeline.events
        ) {
          let payload: unknown;

          switch (eventData.type) {
            case "effect":
              payload = resources.effects.get(
                eventData.payloadId
              );
              break;

            case "audio":
              payload = resources.audio.get(
                eventData.payloadId
              );
              break;

            case "camera":
              payload =
                resources.cameraPaths.get(
                  eventData.payloadId
                );
              break;

            case "panelGroup":
              payload =
                resources.panelGroups.get(
                  eventData.payloadId
                );
              break;

            case "overlay":
              payload =
                resources.overlays.get(
                  eventData.payloadId
                );
              break;

            default:
              console.warn(
                `Unknown timeline event type: ` +
                `${eventData.type}`
              );

              continue;
          }

          /*
           * Do not create a broken timeline event
           * when its resource cannot be found.
           */
          if (!payload) {
            console.warn(
              `Missing ${eventData.type} ` +
              `timeline resource: ` +
              `${eventData.payloadId}`
            );

            continue;
          }

          const timelineEvent =
            new TimelineEvent(
              eventData.timestamp,
              eventData.type,
              payload
            );

          timeline.addEvent(timelineEvent);
        }

        /*
         * Replace the empty timeline created for
         * the new state with the loaded timeline.
         */
        state.timeline = timeline;

        chapter.addState(state);
      }

      story.addChapter(chapter);
    }

    return new ProjectData(
      story,
      resources
    );
  }
}
