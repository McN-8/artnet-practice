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
