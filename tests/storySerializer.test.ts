import assert from "node:assert/strict";
import test from "node:test";
import { ArtNetResources } from "../src/artNetResources.js";
import {
  CURRENT_SCHEMA_VERSION,
  ProjectValidationError
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
