import { mkdir, appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { redactObject } from "./redaction.js";

export interface SessionEvent {
  type: "user" | "assistant" | "tool" | "safety" | "system";
  timestamp: string;
  data: Record<string, unknown>;
}

export function createSessionId(seed?: string): string {
  if (!seed?.trim()) return `session-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const parts = seed.trim().split(/[\\/]+/).filter(Boolean);
  const lastPathSegment = parts[parts.length - 1] ?? "";
  const cleaned = lastPathSegment
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/^-+|-+$/g, "")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120);
  return cleaned || `session-${Date.now()}`;
}

export class SessionLog {
  readonly sessionId: string;
  readonly path: string;

  constructor(workspace: string, sessionId?: string) {
    this.sessionId = createSessionId(sessionId);
    this.path = join(workspace, "sessions", `${this.sessionId}.jsonl`);
  }

  async append(event: Omit<SessionEvent, "timestamp">): Promise<void> {
    await mkdir(join(this.path, ".."), { recursive: true });
    const line = JSON.stringify(redactObject({ ...event, timestamp: new Date().toISOString() }));
    await appendFile(this.path, `${line}\n`, "utf8");
  }

  async readAll(): Promise<SessionEvent[]> {
    const raw = await readFile(this.path, "utf8");
    return raw.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as SessionEvent);
  }
}
