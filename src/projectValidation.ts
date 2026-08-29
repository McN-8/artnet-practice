export const CURRENT_SCHEMA_VERSION = 1;

export interface ProjectValidationIssue {
  path: string;
  message: string;
}

export class ProjectValidationError extends Error {
  issues: ProjectValidationIssue[];

  constructor(issues: ProjectValidationIssue[]) {
    super(
      `Invalid ArtNet project: ${issues
        .map(
          (issue) =>
            `${issue.path} ${issue.message}`
        )
        .join("; ")}`
    );

    this.name = "ProjectValidationError";
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
  expectedType: string,
  issues: ProjectValidationIssue[]
): void {
  issues.push({
    path,
    message:
      value === undefined
        ? "is required"
        : `must be ${expectedType}`
  });
}

function validateState(
  state: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  if (!isRecord(state)) {
    addRequiredTypeIssue(
      state,
      path,
      "an object",
      issues
    );
    return;
  }

  const stringFields = [
    "id",
    "image",
    "dialogue"
  ];

  for (const field of stringFields) {
    if (typeof state[field] !== "string") {
      addRequiredTypeIssue(
        state[field],
        `${path}.${field}`,
        "a string",
        issues
      );
    }
  }

  const booleanFields = [
    "zoomEnabled",
    "zoomInteractive",
    "autoAdvanceEnabled",
    "fastForwardEnabled"
  ];

  for (const field of booleanFields) {
    if (typeof state[field] !== "boolean") {
      addRequiredTypeIssue(
        state[field],
        `${path}.${field}`,
        "a boolean",
        issues
      );
    }
  }

  const numberFields = [
    "autoAdvanceDelay",
    "fastForwardMultiplier"
  ];

  for (const field of numberFields) {
    if (typeof state[field] !== "number") {
      addRequiredTypeIssue(
        state[field],
        `${path}.${field}`,
        "a number",
        issues
      );
    }
  }

  const arrayFields = [
    "zoomRegions",
    "audioCueIds",
    "audioLayersToActivate",
    "audioLayersToDeactivate",
    "prompts",
    "effectIds",
    "assets",
    "cameraBehaviors",
    "cameraFocalPoints",
    "cameraPathIds",
    "cameraEvents",
    "panelGroupIds"
  ];

  for (const field of arrayFields) {
    if (!Array.isArray(state[field])) {
      addRequiredTypeIssue(
        state[field],
        `${path}.${field}`,
        "an array",
        issues
      );
    }
  }

  if (!isRecord(state.timeline)) {
    addRequiredTypeIssue(
      state.timeline,
      `${path}.timeline`,
      "an object",
      issues
    );
  } else if (!Array.isArray(state.timeline.events)) {
    addRequiredTypeIssue(
      state.timeline.events,
      `${path}.timeline.events`,
      "an array",
      issues
    );
  }
}

function validateChapter(
  chapter: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  if (!isRecord(chapter)) {
    addRequiredTypeIssue(
      chapter,
      path,
      "an object",
      issues
    );
    return;
  }

  if (typeof chapter.title !== "string") {
    addRequiredTypeIssue(
      chapter.title,
      `${path}.title`,
      "a string",
      issues
    );
  }

  if (!Array.isArray(chapter.states)) {
    addRequiredTypeIssue(
      chapter.states,
      `${path}.states`,
      "an array",
      issues
    );
    return;
  }

  chapter.states.forEach((state, stateIndex) => {
    validateState(
      state,
      `${path}.states[${stateIndex}]`,
      issues
    );
  });
}

export function validateProjectDocument(
  data: unknown
): asserts data is Record<string, any> {
  const issues: ProjectValidationIssue[] = [];

  if (!isRecord(data)) {
    throw new ProjectValidationError([
      {
        path: "$",
        message: "must be an object"
      }
    ]);
  }

  if (data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    issues.push({
      path: "$.schemaVersion",
      message:
        data.schemaVersion === undefined
          ? "is required"
          : `must equal ${CURRENT_SCHEMA_VERSION}`
    });
  }

  if (typeof data.title !== "string") {
    issues.push({
      path: "$.title",
      message: "must be a string"
    });
  }

  if (typeof data.creator !== "string") {
    issues.push({
      path: "$.creator",
      message: "must be a string"
    });
  }

  if (!isRecord(data.resources)) {
    issues.push({
      path: "$.resources",
      message: "must be an object"
    });
  } else {
    const resourceCollections = [
      "effects",
      "audio",
      "overlays",
      "cameraPaths",
      "panelGroups"
    ];

    for (const collection of resourceCollections) {
      if (!Array.isArray(data.resources[collection])) {
        issues.push({
          path: `$.resources.${collection}`,
          message: "must be an array"
        });
      }
    }
  }

  if (!Array.isArray(data.chapters)) {
    issues.push({
      path: "$.chapters",
      message: "must be an array"
    });
  } else {
    data.chapters.forEach((chapter, chapterIndex) => {
      validateChapter(
        chapter,
        `$.chapters[${chapterIndex}]`,
        issues
      );
    });
  }

  if (issues.length > 0) {
    throw new ProjectValidationError(issues);
  }
}

export function parseAndValidateProjectDocument(
  json: string
): Record<string, any> {
  let data: unknown;

  try {
    data = JSON.parse(json);
  } catch {
    throw new ProjectValidationError([
      {
        path: "$",
        message: "must contain valid JSON"
      }
    ]);
  }

  validateProjectDocument(data);

  return data;
}
