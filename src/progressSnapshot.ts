import { Engine } from "./engine.js";
import { CURRENT_SCHEMA_VERSION } from "./projectSchema.js";
import { Story } from "./story.js";

export const CURRENT_PROGRESS_SNAPSHOT_VERSION = 1;

export type RestoredLifecyclePosition = "stateStart";

export interface ProgressSnapshotV1 {
  snapshotVersion: 1;
  projectSchemaVersion: number;
  storyTitle: string;
  storyVersion: string;
  chapterIndex: number;
  currentStateId: string;
  navigationHistory: string[];
  fastForwardEnabled: boolean;
  lifecyclePosition: RestoredLifecyclePosition;
}

export interface ProgressSnapshotValidationIssue {
  path: string;
  message: string;
}

export class ProgressSnapshotValidationError extends Error {
  issues: ProgressSnapshotValidationIssue[];

  constructor(issues: ProgressSnapshotValidationIssue[]) {
    super(
      `Invalid ArtNet progress snapshot: ${issues
        .map((issue) => `${issue.path} ${issue.message}`)
        .join("; ")}`
    );

    this.name = "ProgressSnapshotValidationError";
    this.issues = issues;
  }
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function addRequiredTypeIssue(
  value: unknown,
  path: string,
  type: string,
  issues: ProgressSnapshotValidationIssue[]
): void {
  issues.push({
    path,
    message: value === undefined ? "is required" : `must be ${type}`
  });
}

export function validateProgressSnapshot(
  data: unknown,
  story: Story,
  expectedStoryVersion: string
): asserts data is ProgressSnapshotV1 {
  const issues: ProgressSnapshotValidationIssue[] = [];

  if (!isRecord(data)) {
    throw new ProgressSnapshotValidationError([
      { path: "$", message: "must be an object" }
    ]);
  }

  const allowedFields = new Set([
    "snapshotVersion",
    "projectSchemaVersion",
    "storyTitle",
    "storyVersion",
    "chapterIndex",
    "currentStateId",
    "navigationHistory",
    "fastForwardEnabled",
    "lifecyclePosition"
  ]);

  Object.keys(data).forEach((field) => {
    if (!allowedFields.has(field)) {
      issues.push({
        path: `$.${field}`,
        message: "is not allowed in progress snapshot version 1"
      });
    }
  });

  if (data.snapshotVersion !== CURRENT_PROGRESS_SNAPSHOT_VERSION) {
    issues.push({
      path: "$.snapshotVersion",
      message:
        data.snapshotVersion === undefined
          ? "is required"
          : `must equal ${CURRENT_PROGRESS_SNAPSHOT_VERSION}`
    });
  }

  if (data.projectSchemaVersion !== CURRENT_SCHEMA_VERSION) {
    issues.push({
      path: "$.projectSchemaVersion",
      message:
        data.projectSchemaVersion === undefined
          ? "is required"
          : `must equal loaded project schema version ${CURRENT_SCHEMA_VERSION}`
    });
  }

  for (const field of [
    "storyTitle",
    "storyVersion",
    "currentStateId",
    "lifecyclePosition"
  ]) {
    if (typeof data[field] !== "string") {
      addRequiredTypeIssue(
        data[field],
        `$.${field}`,
        "a string",
        issues
      );
    }
  }

  if (
    typeof data.chapterIndex !== "number" ||
    !Number.isInteger(data.chapterIndex)
  ) {
    addRequiredTypeIssue(
      data.chapterIndex,
      "$.chapterIndex",
      "an integer",
      issues
    );
  }

  if (typeof data.fastForwardEnabled !== "boolean") {
    addRequiredTypeIssue(
      data.fastForwardEnabled,
      "$.fastForwardEnabled",
      "a boolean",
      issues
    );
  }

  if (!Array.isArray(data.navigationHistory)) {
    addRequiredTypeIssue(
      data.navigationHistory,
      "$.navigationHistory",
      "an array",
      issues
    );
  } else {
    data.navigationHistory.forEach((stateId, index) => {
      if (typeof stateId !== "string") {
        addRequiredTypeIssue(
          stateId,
          `$.navigationHistory[${index}]`,
          "a string",
          issues
        );
      }
    });
  }

  if (
    typeof data.lifecyclePosition === "string" &&
    data.lifecyclePosition !== "stateStart"
  ) {
    issues.push({
      path: "$.lifecyclePosition",
      message: "must be the supported lifecycle position: stateStart"
    });
  }

  if (issues.length === 0) {
    const chapterIndex = data.chapterIndex as number;
    const currentStateId = data.currentStateId as string;
    const navigationHistory = data.navigationHistory as string[];

    if (data.storyTitle !== story.title) {
      issues.push({
        path: "$.storyTitle",
        message: `must match loaded story title "${story.title}"`
      });
    }

    if (data.storyVersion !== expectedStoryVersion) {
      issues.push({
        path: "$.storyVersion",
        message:
          `must match loaded story version ` +
          `"${expectedStoryVersion}"`
      });
    }

    const chapter = story.chapters[chapterIndex];

    if (!chapter) {
      issues.push({
        path: "$.chapterIndex",
        message: "must reference an existing chapter"
      });
    } else if (
      !chapter.states.some((state) => state.id === currentStateId)
    ) {
      issues.push({
        path: "$.currentStateId",
        message:
          `must reference a state in chapter ${chapterIndex}`
      });
    }

    const stateIds = new Set(
      story.chapters.flatMap((value) =>
        value.states.map((state) => state.id)
      )
    );

    navigationHistory.forEach((stateId, index) => {
      if (!stateIds.has(stateId)) {
        issues.push({
          path: `$.navigationHistory[${index}]`,
          message: `references missing state "${stateId}"`
        });
      }
    });
  }

  if (issues.length > 0) {
    throw new ProgressSnapshotValidationError(issues);
  }
}

export function createProgressSnapshot(
  engine: Engine,
  story: Story,
  storyVersion: string
): ProgressSnapshotV1 {
  const chapterIndex = story.chapters.findIndex((chapter) =>
    chapter.states.some((state) => state.id === engine.currentState.id)
  );

  if (chapterIndex < 0) {
    throw new ProgressSnapshotValidationError([
      {
        path: "$.currentStateId",
        message: "engine current state does not belong to the story"
      }
    ]);
  }

  return {
    snapshotVersion: CURRENT_PROGRESS_SNAPSHOT_VERSION,
    projectSchemaVersion: CURRENT_SCHEMA_VERSION,
    storyTitle: story.title,
    storyVersion,
    chapterIndex,
    currentStateId: engine.currentState.id,
    navigationHistory: [...engine.navigationHistory],
    fastForwardEnabled: engine.fastForwardActive,
    lifecyclePosition: "stateStart"
  };
}

export function serializeProgressSnapshot(
  snapshot: ProgressSnapshotV1
): string {
  return JSON.stringify(snapshot, null, 2);
}

export function parseProgressSnapshot(
  json: string,
  story: Story,
  expectedStoryVersion: string
): ProgressSnapshotV1 {
  let data: unknown;

  try {
    data = JSON.parse(json);
  } catch {
    throw new ProgressSnapshotValidationError([
      { path: "$", message: "must contain valid JSON" }
    ]);
  }

  validateProgressSnapshot(data, story, expectedStoryVersion);
  return data;
}

export function restoreProgressSnapshot(
  snapshot: unknown,
  engine: Engine,
  story: Story,
  expectedStoryVersion: string
): void {
  validateProgressSnapshot(snapshot, story, expectedStoryVersion);

  const chapter = story.chapters[snapshot.chapterIndex]!;
  const state = chapter.states.find(
    (value) => value.id === snapshot.currentStateId
  )!;

  engine.navigationHistory = [...snapshot.navigationHistory];
  engine.fastForwardActive = snapshot.fastForwardEnabled;
  engine.restoreStateAtStart(state);
}
