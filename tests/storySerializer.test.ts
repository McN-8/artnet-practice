import assert from "node:assert/strict";
import test from "node:test";
import { ArtNetResources } from "../src/artNetResources.js";
import {
  CURRENT_SCHEMA_VERSION,
  ProjectValidationError,
  validateProjectDocument
} from "../src/projectValidation.js";
import { Story } from "../src/story.js";
import { StorySerializer } from "../src/storySerializer.js";

function emptyProject(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: "Test Story",
    creator: "Test Creator",
    resources: {
      effects: [],
      audio: [],
      overlays: [],
      cameraPaths: [],
      panelGroups: []
    },
    chapters: [],
    ...overrides
  };
}

function validState(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: "state-1",
    image: "forest.png",
    dialogue: "The forest was quiet.",
    zoomEnabled: false,
    zoomInteractive: false,
    zoomRegions: [],
    audioCueIds: [],
    audioLayersToActivate: [],
    audioLayersToDeactivate: [],
    prompts: [],
    effectIds: [],
    assets: [],
    cameraBehaviors: [],
    cameraFocalPoints: [],
    cameraPathIds: [],
    cameraEvents: [],
    panelGroupIds: [],
    timeline: { events: [] },
    autoAdvanceEnabled: false,
    autoAdvanceDelay: 0,
    fastForwardEnabled: true,
    fastForwardMultiplier: 2,
    ...overrides
  };
}

function validResources(): Record<string, unknown[]> {
  return {
    effects: [
      {
        id: "leaf-drift",
        type: "floatingLeaves",
        trigger: "onEnterState",
        duration: 5000
      }
    ],
    audio: [
      {
        id: "forest-ambience",
        file: "forest.mp3",
        type: "ambience",
        loop: true,
        volume: 0.8,
        trigger: "onEnterState",
        persistsAcrossStates: true,
        fadeInDuration: 500,
        fadeOutDuration: 500,
        layerGroup: "forest"
      }
    ],
    overlays: [
      {
        id: "leaf-overlay",
        asset: "leaf.png",
        pathId: "opening-pan",
        rotation: 0,
        duration: 1000,
        followPath: true
      }
    ],
    cameraPaths: [
      {
        id: "opening-pan",
        startPoint: {
          id: "start",
          x: 0,
          y: 0,
          zoomLevel: 1
        },
        endPoint: {
          id: "end",
          x: 100,
          y: 100,
          zoomLevel: 2
        },
        duration: 1000,
        easing: "easeInOut",
        speedMultiplier: 1
      }
    ],
    panelGroups: [
      {
        id: "opening-panels",
        reveals: [
          {
            panelId: "panel-1",
            delay: 0,
            x: 0,
            y: 0,
            width: 800,
            height: 450,
            rotation: 0
          }
        ]
      }
    ]
  };
}

function projectWithState(
  state: Record<string, unknown>
): Record<string, unknown> {
  return emptyProject({
    chapters: [
      {
        title: "Chapter One",
        states: [state]
      }
    ]
  });
}

test("serializer writes the current schema version", () => {
  const json = StorySerializer.toJSON(
    new Story("Test Story", "Test Creator"),
    new ArtNetResources()
  );

  const serialized = JSON.parse(json);

  assert.equal(
    serialized.schemaVersion,
    CURRENT_SCHEMA_VERSION
  );
});

test("loader accepts a valid version 1 envelope", () => {
  const project = StorySerializer.fromJSON(
    JSON.stringify(emptyProject())
  );

  assert.equal(project.story.title, "Test Story");
  assert.equal(project.story.creator, "Test Creator");
  assert.equal(project.story.chapters.length, 0);
});

test("loader accepts valid chapters and states", () => {
  const project = StorySerializer.fromJSON(
    JSON.stringify(
      emptyProject({
        chapters: [
          {
            title: "Chapter One",
            states: [validState()]
          }
        ]
      })
    )
  );

  assert.equal(project.story.chapters.length, 1);
  assert.equal(
    project.story.chapters[0]?.states[0]?.id,
    "state-1"
  );
});

test("loader reports malformed JSON consistently", () => {
  assert.throws(
    () => StorySerializer.fromJSON("{"),
    (error) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.deepEqual(error.issues, [
        {
          path: "$",
          message: "must contain valid JSON"
        }
      ]);
      return true;
    }
  );
});

test("loader rejects a missing schema version", () => {
  const document = emptyProject();
  delete document.schemaVersion;

  assert.throws(
    () => StorySerializer.fromJSON(
      JSON.stringify(document)
    ),
    (error) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.deepEqual(error.issues, [
        {
          path: "$.schemaVersion",
          message: "is required"
        }
      ]);
      return true;
    }
  );
});

test("loader rejects unsupported schema versions", () => {
  assert.throws(
    () => StorySerializer.fromJSON(
      JSON.stringify(
        emptyProject({ schemaVersion: 2 })
      )
    ),
    (error) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.deepEqual(error.issues, [
        {
          path: "$.schemaVersion",
          message: `must equal ${CURRENT_SCHEMA_VERSION}`
        }
      ]);
      return true;
    }
  );
});

test("loader reports all invalid envelope fields", () => {
  assert.throws(
    () => StorySerializer.fromJSON(
      JSON.stringify(
        emptyProject({
          title: 42,
          creator: null,
          resources: {},
          chapters: "not-an-array"
        })
      )
    ),
    (error) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.equal(error.issues.length, 8);
      assert.deepEqual(error.issues[0], {
        path: "$.title",
        message: "must be a string"
      });
      assert.deepEqual(error.issues.at(-1), {
        path: "$.chapters",
        message: "must be an array"
      });
      return true;
    }
  );
});

test("loader reports required chapter fields", () => {
  assert.throws(
    () => StorySerializer.fromJSON(
      JSON.stringify(
        emptyProject({ chapters: [{}] })
      )
    ),
    (error) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.deepEqual(error.issues, [
        {
          path: "$.chapters[0].title",
          message: "is required"
        },
        {
          path: "$.chapters[0].states",
          message: "is required"
        }
      ]);
      return true;
    }
  );
});

test("loader reports non-object chapters and states", () => {
  assert.throws(
    () => StorySerializer.fromJSON(
      JSON.stringify(
        emptyProject({
          chapters: [
            null,
            {
              title: "Chapter Two",
              states: [null]
            }
          ]
        })
      )
    ),
    (error) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.deepEqual(error.issues, [
        {
          path: "$.chapters[0]",
          message: "must be an object"
        },
        {
          path: "$.chapters[1].states[0]",
          message: "must be an object"
        }
      ]);
      return true;
    }
  );
});

test("loader aggregates nested state field errors", () => {
  const state = validState({
    image: 42,
    prompts: "not-an-array",
    timeline: {}
  });
  delete state.id;

  assert.throws(
    () => StorySerializer.fromJSON(
      JSON.stringify(
        emptyProject({
          chapters: [
            {
              title: "Chapter One",
              states: [state]
            }
          ]
        })
      )
    ),
    (error) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.deepEqual(error.issues, [
        {
          path: "$.chapters[0].states[0].id",
          message: "is required"
        },
        {
          path: "$.chapters[0].states[0].image",
          message: "must be a string"
        },
        {
          path: "$.chapters[0].states[0].prompts",
          message: "must be an array"
        },
        {
          path: "$.chapters[0].states[0].timeline.events",
          message: "is required"
        }
      ]);
      return true;
    }
  );
});

test("validator accepts supported nested event data", () => {
  const state = validState({
    prompts: [
      {
        inputType: "tapRight",
        targetId: "detail-1",
        transition: {
          destinationStateId: "state-2",
          effect: {
            type: "fadeIn",
            duration: 500,
            allowFastForward: true,
            locksInput: false
          },
          triggeredAudioCueIds: ["page-turn"]
        }
      }
    ],
    cameraEvents: [
      {
        triggerTime: 250,
        cameraPathId: "opening-pan"
      }
    ],
    timeline: {
      events: [
        {
          timestamp: 100,
          type: "camera",
          payloadId: "opening-pan"
        }
      ]
    }
  });

  assert.doesNotThrow(() => {
    validateProjectDocument(projectWithState(state));
  });
});

test("validator reports prompt and transition errors", () => {
  const state = validState({
    prompts: [
      {
        inputType: "unsupportedInput",
        targetId: 12,
        transition: {
          destinationStateId: 42,
          effect: {
            type: false,
            duration: "slow",
            allowFastForward: "yes"
          },
          triggeredAudioCueIds: ["valid-cue", 7]
        }
      }
    ]
  });

  assert.throws(
    () => validateProjectDocument(
      projectWithState(state)
    ),
    (error) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.deepEqual(error.issues, [
        {
          path: "$.chapters[0].states[0].prompts[0].inputType",
          message: "must be a supported input type"
        },
        {
          path: "$.chapters[0].states[0].prompts[0].targetId",
          message: "must be a string"
        },
        {
          path: "$.chapters[0].states[0].prompts[0].transition.destinationStateId",
          message: "must be a string"
        },
        {
          path: "$.chapters[0].states[0].prompts[0].transition.effect.type",
          message: "must be a string"
        },
        {
          path: "$.chapters[0].states[0].prompts[0].transition.effect.duration",
          message: "must be a number"
        },
        {
          path: "$.chapters[0].states[0].prompts[0].transition.effect.allowFastForward",
          message: "must be a boolean"
        },
        {
          path: "$.chapters[0].states[0].prompts[0].transition.effect.locksInput",
          message: "is required"
        },
        {
          path: "$.chapters[0].states[0].prompts[0].transition.triggeredAudioCueIds[1]",
          message: "must be a string"
        }
      ]);
      return true;
    }
  );
});

test("validator reports timeline-event errors", () => {
  const state = validState({
    timeline: {
      events: [
        null,
        {
          timestamp: "later",
          type: "unknownEvent"
        }
      ]
    }
  });

  assert.throws(
    () => validateProjectDocument(
      projectWithState(state)
    ),
    (error) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.deepEqual(error.issues, [
        {
          path: "$.chapters[0].states[0].timeline.events[0]",
          message: "must be an object"
        },
        {
          path: "$.chapters[0].states[0].timeline.events[1].timestamp",
          message: "must be a number"
        },
        {
          path: "$.chapters[0].states[0].timeline.events[1].type",
          message: "must be a supported timeline event type"
        },
        {
          path: "$.chapters[0].states[0].timeline.events[1].payloadId",
          message: "is required"
        }
      ]);
      return true;
    }
  );
});

test("validator reports camera-event errors", () => {
  const state = validState({
    cameraEvents: [
      null,
      {
        triggerTime: "later"
      }
    ]
  });

  assert.throws(
    () => validateProjectDocument(
      projectWithState(state)
    ),
    (error) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.deepEqual(error.issues, [
        {
          path: "$.chapters[0].states[0].cameraEvents[0]",
          message: "must be an object"
        },
        {
          path: "$.chapters[0].states[0].cameraEvents[1].triggerTime",
          message: "must be a number"
        },
        {
          path: "$.chapters[0].states[0].cameraEvents[1].cameraPathId",
          message: "is required"
        }
      ]);
      return true;
    }
  );
});

test("validator accepts resource and remaining state data", () => {
  const state = validState({
    zoomRegions: [
      {
        id: "detail",
        x: 10,
        y: 20,
        width: 100,
        height: 80,
        description: "A hidden detail"
      }
    ],
    audioCueIds: ["forest-ambience"],
    audioLayersToActivate: ["forest"],
    audioLayersToDeactivate: ["interior"],
    effectIds: ["leaf-drift"],
    assets: [{ file: "forest.png", type: "image" }],
    cameraBehaviors: [
      { type: "slowPan", duration: 1000 }
    ],
    cameraFocalPoints: [
      { id: "focus", x: 10, y: 20, zoomLevel: 1.5 }
    ],
    cameraPathIds: ["opening-pan"],
    panelGroupIds: ["opening-panels"]
  });

  assert.doesNotThrow(() => {
    validateProjectDocument(
      emptyProject({
        resources: validResources(),
        chapters: [
          { title: "Chapter One", states: [state] }
        ]
      })
    );
  });
});

test("validator reports resource-definition errors", () => {
  const resources = validResources();

  resources.effects = [
    {
      id: "effect",
      type: "glow",
      trigger: "onEnterState",
      duration: "long"
    }
  ];
  resources.audio = [
    {
      id: "audio",
      file: "sound.mp3",
      type: "music",
      loop: "yes",
      volume: 1,
      trigger: "onEnterState",
      persistsAcrossStates: false,
      fadeInDuration: 0,
      fadeOutDuration: 0,
      layerGroup: "music"
    }
  ];
  resources.overlays = [
    {
      id: "overlay",
      asset: "overlay.png",
      pathId: "path",
      rotation: 0,
      duration: 100,
      followPath: 1
    }
  ];
  resources.cameraPaths = [
    {
      id: "path",
      startPoint: {
        id: "start",
        x: "left",
        y: 0,
        zoomLevel: 1
      },
      endPoint: {
        id: "end",
        x: 1,
        y: 1,
        zoomLevel: 2
      },
      duration: 100,
      easing: "linear",
      speedMultiplier: 1
    }
  ];
  resources.panelGroups = [
    {
      id: "group",
      reveals: [
        {
          panelId: "panel",
          delay: 0,
          x: 0,
          y: 0,
          width: "wide",
          height: 100,
          rotation: 0
        }
      ]
    }
  ];

  assert.throws(
    () => validateProjectDocument(
      emptyProject({ resources })
    ),
    (error) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.deepEqual(error.issues, [
        {
          path: "$.resources.effects[0].duration",
          message: "must be a number"
        },
        {
          path: "$.resources.audio[0].loop",
          message: "must be a boolean"
        },
        {
          path: "$.resources.overlays[0].followPath",
          message: "must be a boolean"
        },
        {
          path: "$.resources.cameraPaths[0].startPoint.x",
          message: "must be a number"
        },
        {
          path: "$.resources.panelGroups[0].reveals[0].width",
          message: "must be a number"
        }
      ]);
      return true;
    }
  );
});

test("validator reports remaining state-content errors", () => {
  const state = validState({
    zoomRegions: [
      {
        id: "detail",
        x: 0,
        y: 0,
        width: 100,
        height: 100
      }
    ],
    audioCueIds: [4],
    audioLayersToActivate: ["valid", false],
    effectIds: [null],
    assets: [null],
    cameraBehaviors: [
      { type: "pan", duration: "slow" }
    ],
    cameraFocalPoints: [
      { id: "focus", x: 0, y: "down", zoomLevel: 1 }
    ],
    cameraPathIds: [{}],
    panelGroupIds: ["valid", 9]
  });

  assert.throws(
    () => validateProjectDocument(
      projectWithState(state)
    ),
    (error) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.deepEqual(error.issues, [
        {
          path: "$.chapters[0].states[0].audioCueIds[0]",
          message: "must be a string"
        },
        {
          path: "$.chapters[0].states[0].audioLayersToActivate[1]",
          message: "must be a string"
        },
        {
          path: "$.chapters[0].states[0].effectIds[0]",
          message: "must be a string"
        },
        {
          path: "$.chapters[0].states[0].cameraPathIds[0]",
          message: "must be a string"
        },
        {
          path: "$.chapters[0].states[0].panelGroupIds[1]",
          message: "must be a string"
        },
        {
          path: "$.chapters[0].states[0].zoomRegions[0].description",
          message: "is required"
        },
        {
          path: "$.chapters[0].states[0].assets[0]",
          message: "must be an object"
        },
        {
          path: "$.chapters[0].states[0].cameraBehaviors[0].duration",
          message: "must be a number"
        },
        {
          path: "$.chapters[0].states[0].cameraFocalPoints[0].y",
          message: "must be a number"
        }
      ]);
      return true;
    }
  );
});
