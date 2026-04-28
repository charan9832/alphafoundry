import type { ToolObservation } from "../tools/types.js";
import type { ResearchRun } from "./runState.js";
import { researchDisclaimer } from "../safety.js";

export interface ResponseFormatInput {
  run: ResearchRun;
  observations: { toolName: string; result: ToolObservation | unknown }[];
  finalText: string;
}

function artifactLines(run: ResearchRun): string[] {
  return run.artifacts.length ? ["", "Artifacts:", ...run.artifacts.map((path) => `- ${path}`)] : [];
}

export function formatHumanResponse(input: ResponseFormatInput): string {
  const toolLines = input.observations.length
    ? ["", "Tool steps:", ...input.observations.map((item) => `- ${item.toolName}`)]
    : [];
  return [
    input.finalText,
    "",
    `Run: ${input.run.runId}`,
    `Status: ${input.run.status}`,
    `Stop reason: ${input.run.stopReason ?? "not set"}`,
    ...toolLines,
    ...artifactLines(input.run),
    "",
    researchDisclaimer(),
  ].join("\n");
}

export function formatJsonResponse(input: ResponseFormatInput): { run: ResearchRun; observations: { toolName: string; result: unknown }[]; finalText: string } {
  return input;
}
