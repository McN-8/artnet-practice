import type { ProjectData } from "./projectData.js";
import type { ProgressSnapshotV1 } from "./progressSnapshot.js";
import {
  parseProgressSnapshot,
  serializeProgressSnapshot,
  validateProgressSnapshot
} from "./progressSnapshot.js";
import type { Story } from "./story.js";
import { StorySerializer } from "./storySerializer.js";
import { validateProjectDocument } from "./projectValidation.js";

export interface TextStorage {
  read(key: string): Promise<string | undefined>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** In-memory test/editor adapter; it does not survive process exit. */
export class MemoryTextStorage implements TextStorage {
  private values = new Map<string, string>();

  async read(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }

  async write(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

export class ProjectRepository {
  constructor(private readonly storage: TextStorage) {}

  async saveProject(key: string, project: ProjectData): Promise<void> {
    const json = StorySerializer.toJSON(project.story, project.resources);
    validateProjectDocument(JSON.parse(json));
    await this.storage.write(
      this.key("project", key),
      json
    );
  }

  async loadProject(key: string): Promise<ProjectData | undefined> {
    const json = await this.storage.read(this.key("project", key));
    return json === undefined ? undefined : StorySerializer.fromJSON(json);
  }

  async saveProgress(
    key: string,
    snapshot: ProgressSnapshotV1,
    story: Story,
    storyVersion: string
  ): Promise<void> {
    validateProgressSnapshot(snapshot, story, storyVersion);
    await this.storage.write(
      this.key("progress", key), serializeProgressSnapshot(snapshot)
    );
  }

  async loadProgress(
    key: string,
    story: Story,
    storyVersion: string
  ): Promise<ProgressSnapshotV1 | undefined> {
    const json = await this.storage.read(this.key("progress", key));
    return json === undefined
      ? undefined
      : parseProgressSnapshot(json, story, storyVersion);
  }

  private key(kind: "project" | "progress", key: string): string {
    if (key.trim().length === 0) throw new Error("Storage key must be nonblank");
    return `${kind}:${key}`;
  }
}
