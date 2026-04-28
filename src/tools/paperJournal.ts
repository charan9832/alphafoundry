import type { ToolDefinition } from "./types.js";
import { failedObservation, observation } from "./types.js";
import { containsSecretLikeValue } from "../config.js";
import { redactSecrets } from "../redaction.js";
import { appendJsonl, safeId, safeWorkspacePath, timestampId, writeJsonFile } from "../workspace.js";

interface PaperJournalEntry {
  id: string;
  timestamp: string;
  symbol: string;
  hypothesis: string;
  status: "draft" | "active-paper" | "reviewed" | "archived";
  projectId?: string;
  linkedArtifactPath?: string;
  notes?: string;
  warnings: string[];
}

const warnings = ["Offline paper journal only. No broker connection, account access, order placement, or live execution."];

function journalPath(workspace: string): string {
  return safeWorkspacePath(workspace, "paper-journal", "entries.jsonl");
}

export function paperJournalTools(): ToolDefinition[] {
  return [createPaperJournalEntryTool(), listPaperJournalEntriesTool()];
}

function createPaperJournalEntryTool(): ToolDefinition<{ symbol: string; hypothesis: string; projectId?: string; linkedArtifactPath?: string; notes?: string }, PaperJournalEntry> {
  return {
    name: "create_paper_journal_entry",
    description: "Create an offline paper-validation journal entry. This never places orders or connects to brokers/accounts.",
    category: "report",
    schema: { type: "object", required: ["symbol", "hypothesis"], properties: { symbol: { type: "string" }, hypothesis: { type: "string" }, projectId: { type: "string" }, linkedArtifactPath: { type: "string" }, notes: { type: "string" } }, additionalProperties: false },
    async execute(input, context) {
      if (!input.symbol?.trim()) return failedObservation("create_paper_journal_entry", "symbol is required") as never;
      if (!input.hypothesis?.trim()) return failedObservation("create_paper_journal_entry", "hypothesis is required") as never;
      const combined = `${input.hypothesis} ${input.notes ?? ""}`;
      if (containsSecretLikeValue(combined)) return failedObservation("create_paper_journal_entry", "refusing to store secret-like value in paper journal") as never;
      const id = timestampId("paper");
      const entry: PaperJournalEntry = {
        id,
        timestamp: new Date().toISOString(),
        symbol: input.symbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, ""),
        hypothesis: redactSecrets(input.hypothesis.trim()),
        status: "draft",
        warnings,
      };
      if (input.projectId?.trim()) entry.projectId = safeId(input.projectId, "project id");
      if (input.linkedArtifactPath?.trim()) {
        if (!input.linkedArtifactPath.startsWith(context.workspace)) return failedObservation("create_paper_journal_entry", "linked artifact must be inside workspace") as never;
        entry.linkedArtifactPath = input.linkedArtifactPath;
      }
      if (input.notes?.trim()) entry.notes = redactSecrets(input.notes.trim());
      await appendJsonl(journalPath(context.workspace), entry);
      await writeJsonFile(safeWorkspacePath(context.workspace, "paper-journal", "entries", `${id}.json`), entry);
      return observation("create_paper_journal_entry", entry, { provenance: { path: journalPath(context.workspace) }, warnings });
    },
  };
}

function listPaperJournalEntriesTool(): ToolDefinition<{ limit?: number }, PaperJournalEntry[]> {
  return {
    name: "list_paper_journal_entries",
    description: "List recent offline paper-validation journal entries.",
    category: "report",
    schema: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false },
    async execute(input, context) {
      try {
        const { readFile } = await import("node:fs/promises");
        const content = await readFile(journalPath(context.workspace), "utf8");
        const entries = content.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as PaperJournalEntry);
        const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 100);
        return observation("list_paper_journal_entries", entries.slice(-limit), { provenance: { path: journalPath(context.workspace) }, warnings });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return observation("list_paper_journal_entries", [], { provenance: { path: journalPath(context.workspace) }, warnings });
        throw error;
      }
    },
  };
}
