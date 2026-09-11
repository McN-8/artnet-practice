import { CURRENT_SCHEMA_VERSION } from "./projectSchema.js";

export interface ProjectMigrationIssue {
  path: string;
  message: string;
}

export class ProjectMigrationError extends Error {
  issues: ProjectMigrationIssue[];

  constructor(issues: ProjectMigrationIssue[]) {
    super(
      `Could not migrate ArtNet project: ${issues
        .map((issue) => `${issue.path} ${issue.message}`)
        .join("; ")}`
    );

    this.name = "ProjectMigrationError";
    this.issues = issues;
  }
}

type ProjectDocument = Record<string, unknown>;
type ProjectMigration = (
  document: ProjectDocument
) => ProjectDocument;

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function migrateVersion0To1(
  document: ProjectDocument
): ProjectDocument {
  const issues: ProjectMigrationIssue[] = [];

  if (Array.isArray(document.chapters)) {
    document.chapters.forEach((chapter, chapterIndex) => {
      if (!isRecord(chapter) || !Array.isArray(chapter.states)) {
        return;
      }

      const chapterPath = `$.chapters[${chapterIndex}]`;
      const firstState = chapter.states[0];

      if (
        !isRecord(firstState) ||
        typeof firstState.id !== "string"
      ) {
        issues.push({
          path: `${chapterPath}.entryStateId`,
          message:
            "cannot be derived because the chapter has no first state with a string ID"
        });
      } else {
        chapter.entryStateId = firstState.id;
      }

      chapter.states.forEach((state) => {
        if (isRecord(state) && Array.isArray(state.prompts)) {
          state.isEnding = state.prompts.length === 0;
        }
      });
    });
  }

  if (issues.length > 0) {
    throw new ProjectMigrationError(issues);
  }

  document.schemaVersion = 1;
  return document;
}

const MIGRATIONS = new Map<number, ProjectMigration>([
  [0, migrateVersion0To1]
]);

export function migrateProjectDocument(
  data: unknown
): unknown {
  if (!isRecord(data)) {
    return data;
  }

  const sourceVersion = data.schemaVersion;

  if (sourceVersion === CURRENT_SCHEMA_VERSION) {
    return data;
  }

  if (
    typeof sourceVersion !== "number" ||
    !Number.isInteger(sourceVersion)
  ) {
    return data;
  }

  if (sourceVersion > CURRENT_SCHEMA_VERSION) {
    throw new ProjectMigrationError([
      {
        path: "$.schemaVersion",
        message:
          `version ${sourceVersion} is newer than supported version ` +
          `${CURRENT_SCHEMA_VERSION}`
      }
    ]);
  }

  let document = structuredClone(data);
  let version = sourceVersion;

  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = MIGRATIONS.get(version);

    if (!migration) {
      throw new ProjectMigrationError([
        {
          path: "$.schemaVersion",
          message:
            `has no migration path from version ${version} ` +
            `to version ${CURRENT_SCHEMA_VERSION}`
        }
      ]);
    }

    document = migration(document);
    version += 1;

    if (document.schemaVersion !== version) {
      throw new ProjectMigrationError([
        {
          path: "$.schemaVersion",
          message:
            `migration from version ${version - 1} did not produce version ${version}`
        }
      ]);
    }
  }

  return document;
}
