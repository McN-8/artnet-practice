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
