import { mkdir, appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { redactObject } from "./redaction.js";

export interface SessionEvent {
  type: "user" | "assistant" | "tool" | "safety" | "system";
  timestamp: string;
  data: Record<string, unknown>;
}

export class SessionLog {
  readonly path: string;

  constructor(workspace: string, sessionId = new Date().toISOString().replace(/[:.]/g, "-")) {
    this.path = join(workspace, "sessions", `${sessionId}.jsonl`);
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
