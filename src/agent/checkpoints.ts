import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ResearchRun } from "./runState.js";

export interface RunCheckpoint {
  checkpointId: string;
  threadId: string;
  runId: string;
  reason: string;
  timestamp: string;
  path: string;
  run: ResearchRun;
}

function timestamp(): string {
  return new Date().toISOString();
}

function checkpointId(): string {
  return `checkpoint-${timestamp().replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class CheckpointStore {
  constructor(private readonly workspace: string) {}

  private dir(threadId: string, runId: string): string {
    return join(this.workspace, "runs", threadId, runId, "checkpoints");
  }

  private path(threadId: string, runId: string, id: string): string {
    return join(this.dir(threadId, runId), `${id}.json`);
  }

  async write(run: ResearchRun, reason: string): Promise<RunCheckpoint> {
    const id = checkpointId();
    const path = this.path(run.threadId, run.runId, id);
    const checkpoint: RunCheckpoint = {
      checkpointId: id,
      threadId: run.threadId,
      runId: run.runId,
      reason,
      timestamp: timestamp(),
      path,
      run,
    };
    await mkdir(this.dir(run.threadId, run.runId), { recursive: true });
    await writeFile(path, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
    return checkpoint;
  }

  async read(threadId: string, runId: string, id: string): Promise<RunCheckpoint> {
    return JSON.parse(await readFile(this.path(threadId, runId, id), "utf8")) as RunCheckpoint;
  }

  async list(threadId: string, runId: string): Promise<RunCheckpoint[]> {
    try {
      const names = (await readdir(this.dir(threadId, runId))).filter((name) => name.endsWith(".json")).sort();
      const checkpoints = await Promise.all(names.map((name) => readFile(join(this.dir(threadId, runId), name), "utf8").then((raw) => JSON.parse(raw) as RunCheckpoint)));
      return checkpoints.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
