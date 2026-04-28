import type { ToolDefinition } from "./types.js";
import { failedObservation, observation } from "./types.js";
import { appendJsonl, readJsonFile, safeId, safeWorkspacePath, timestampId, writeJsonFile } from "../workspace.js";
import { resolve } from "node:path";

interface ProjectRecord {
  id: string;
  name: string;
  status: "active" | "paused" | "complete";
  createdAt: string;
  updatedAt: string;
  thesis?: string;
  symbols: string[];
  artifactPaths: string[];
  warnings: string[];
}

function indexPath(workspace: string): string {
  return safeWorkspacePath(workspace, "projects", "index.json");
}

function projectPath(workspace: string, id: string): string {
  return safeWorkspacePath(workspace, "projects", id, "project.json");
}

async function readIndex(workspace: string): Promise<string[]> {
  return readJsonFile<string[]>(indexPath(workspace), []);
}

async function writeIndex(workspace: string, ids: string[]): Promise<void> {
  await writeJsonFile(indexPath(workspace), [...new Set(ids)].sort());
}

async function readProject(workspace: string, id: string): Promise<ProjectRecord | null> {
  const cleaned = safeId(id, "project id");
  return readJsonFile<ProjectRecord | null>(projectPath(workspace, cleaned), null);
}

export function projectTools(): ToolDefinition[] {
  return [createProjectTool(), listProjectsTool(), getProjectTool(), linkProjectArtifactTool()];
}

function createProjectTool(): ToolDefinition<{ name: string; thesis?: string; symbols?: string[] }, ProjectRecord> {
  return {
    name: "create_project",
    description: "Create a local AlphaFoundry workspace project with safe local persistence and no external action capability.",
    category: "system",
    schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, thesis: { type: "string" }, symbols: { type: "array", items: { type: "string" } } }, additionalProperties: false },
    async execute(input, context) {
      try {
        const id = safeId(input.name, "project name");
        const now = new Date().toISOString();
        const record: ProjectRecord = {
          id,
          name: input.name.trim(),
          status: "active",
          createdAt: now,
          updatedAt: now,
          symbols: (input.symbols ?? []).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean),
          artifactPaths: [],
          warnings: ["Local workspace record only. This does not enable external actions or account access."],
        };
        if (input.thesis?.trim()) record.thesis = input.thesis.trim();
        await writeJsonFile(projectPath(context.workspace, id), record);
        await writeIndex(context.workspace, [...await readIndex(context.workspace), id]);
        await appendJsonl(safeWorkspacePath(context.workspace, "projects", id, "events.jsonl"), { type: "created", timestamp: now, projectId: id });
        return observation("create_project", record, { provenance: { path: projectPath(context.workspace, id) }, warnings: record.warnings });
      } catch (error) {
        return failedObservation("create_project", error instanceof Error ? error.message : String(error)) as never;
      }
    },
  };
}

function listProjectsTool(): ToolDefinition<Record<string, never>, ProjectRecord[]> {
  return {
    name: "list_projects",
    description: "List local AlphaFoundry workspace projects.",
    category: "system",
    schema: { type: "object", additionalProperties: false },
    async execute(_input, context) {
      const records: ProjectRecord[] = [];
      for (const id of await readIndex(context.workspace)) {
        const record = await readProject(context.workspace, id);
        if (record) records.push(record);
      }
      return observation("list_projects", records, { provenance: { path: indexPath(context.workspace) } });
    },
  };
}

function getProjectTool(): ToolDefinition<{ id: string }, ProjectRecord> {
  return {
    name: "get_project",
    description: "Read one local AlphaFoundry workspace project.",
    category: "system",
    schema: { type: "object", required: ["id"], properties: { id: { type: "string" } }, additionalProperties: false },
    async execute(input, context) {
      const record = await readProject(context.workspace, input.id);
      if (!record) return failedObservation("get_project", "project not found") as never;
      return observation("get_project", record, { provenance: { path: projectPath(context.workspace, safeId(input.id, "project id")) } });
    },
  };
}

function linkProjectArtifactTool(): ToolDefinition<{ id: string; artifactPath: string }, ProjectRecord> {
  return {
    name: "link_project_artifact",
    description: "Link an existing local artifact path to a project record for provenance tracking.",
    category: "system",
    schema: { type: "object", required: ["id", "artifactPath"], properties: { id: { type: "string" }, artifactPath: { type: "string" } }, additionalProperties: false },
    async execute(input, context) {
      const id = safeId(input.id, "project id");
      const record = await readProject(context.workspace, id);
      if (!record) return failedObservation("link_project_artifact", "project not found") as never;
      const workspaceRoot = resolve(context.workspace);
      const artifact = resolve(input.artifactPath);
      if (artifact !== workspaceRoot && !artifact.startsWith(`${workspaceRoot}/`)) return failedObservation("link_project_artifact", "artifact must be inside workspace") as never;
      const updated: ProjectRecord = { ...record, updatedAt: new Date().toISOString(), artifactPaths: [...new Set([...record.artifactPaths, artifact])] };
      await writeJsonFile(projectPath(context.workspace, id), updated);
      await appendJsonl(safeWorkspacePath(context.workspace, "projects", id, "events.jsonl"), { type: "artifact_linked", timestamp: updated.updatedAt, artifactPath: artifact });
      return observation("link_project_artifact", updated, { provenance: { eventId: timestampId("event") } });
    },
  };
}
