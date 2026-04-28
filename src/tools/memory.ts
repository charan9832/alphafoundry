import type { ToolDefinition } from "./types.js";
import { failedObservation, observation } from "./types.js";
import { containsSecretLikeValue } from "../config.js";
import { redactSecrets } from "../redaction.js";
import { appendJsonl, readJsonFile, safeId, safeWorkspacePath, timestampId } from "../workspace.js";

interface LessonRecord {
  id: string;
  timestamp: string;
  lesson: string;
  source?: string;
  projectId?: string;
  warnings: string[];
}

const warnings = ["Local memory only. Notes cannot override safety gates or tool permissions."];

function lessonsPath(workspace: string): string {
  return safeWorkspacePath(workspace, "memory", "lessons.jsonl");
}

async function readLessons(workspace: string): Promise<LessonRecord[]> {
  const raw = await readJsonFile<string | null>(safeWorkspacePath(workspace, "memory", "_not_used.json"), null).catch(() => null);
  void raw;
  try {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(lessonsPath(workspace), "utf8");
    return content.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as LessonRecord);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export function memoryTools(): ToolDefinition[] {
  return [rememberLessonTool(), listLessonsTool()];
}

function rememberLessonTool(): ToolDefinition<{ lesson: string; source?: string; projectId?: string }, LessonRecord> {
  return {
    name: "remember_lesson",
    description: "Store a durable local agent note with provenance. Secrets are rejected/redacted and notes never enable external actions.",
    category: "memory",
    schema: { type: "object", required: ["lesson"], properties: { lesson: { type: "string" }, source: { type: "string" }, projectId: { type: "string" } }, additionalProperties: false },
    async execute(input, context) {
      if (!input.lesson?.trim()) return failedObservation("remember_lesson", "lesson is required") as never;
      if (containsSecretLikeValue(input.lesson)) return failedObservation("remember_lesson", "refusing to store secret-like value in memory") as never;
      const record: LessonRecord = {
        id: timestampId("lesson"),
        timestamp: new Date().toISOString(),
        lesson: redactSecrets(input.lesson.trim()),
        warnings,
      };
      if (input.source?.trim()) record.source = redactSecrets(input.source.trim());
      if (input.projectId?.trim()) record.projectId = safeId(input.projectId, "project id");
      await appendJsonl(lessonsPath(context.workspace), record);
      return observation("remember_lesson", record, { provenance: { path: lessonsPath(context.workspace) }, warnings });
    },
  };
}

function listLessonsTool(): ToolDefinition<{ limit?: number }, LessonRecord[]> {
  return {
    name: "list_lessons",
    description: "List recent local AlphaFoundry agent notes.",
    category: "memory",
    schema: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false },
    async execute(input, context) {
      const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 100);
      const lessons = (await readLessons(context.workspace)).slice(-limit);
      return observation("list_lessons", lessons, { provenance: { path: lessonsPath(context.workspace) }, warnings });
    },
  };
}
