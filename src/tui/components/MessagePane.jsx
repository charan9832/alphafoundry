import React from "react";
import { Box, Text } from "ink";
import { DiffBlock } from "./DiffBlock.jsx";
import { FileTree } from "./FileTree.jsx";
import { CommandBlock } from "./CommandBlock.jsx";
import { wrapPlain } from "../formatters.js";
import { theme } from "../theme.js";

const labels = {
  user: "YOU",
  assistant: "ALPHA",
  system: "SYS",
  tool: "TOOL",
  stdout: "OUT",
  stderr: "ERR",
  error: "ERR",
  stats: "USAGE",
  session: "SESSION",
  artifact: "ARTIFACT",
  command: "CMD",
  diff: "DIFF",
  tree: "TREE",
};

function colorFor(event) {
  if (event.type === "user") return theme.accent.brand;
  if (event.type === "assistant") return theme.fg.primary;
  if (event.type === "error" || event.type === "stderr") return theme.state.danger;
  if (event.type === "tool" || event.type === "command") return theme.state.running;
  if (event.type === "artifact") return theme.state.success;
  if (event.type === "diff") return theme.diff.hunk;
  return theme.fg.tertiary;
}

function Separator({ label, width }) {
  const text = ` ${String(label ?? "RUNTIME EVENTS").toUpperCase()} `;
  const left = Math.max(1, Math.floor((width - text.length) / 2));
  const right = Math.max(1, width - left - text.length);
  return <Text color={theme.surface.border}>{"─".repeat(left)}{text}{"─".repeat(right)}</Text>;
}

function TextEvent({ event, width }) {
  const text = event.text ?? event.output ?? event.error ?? "";
  const label = labels[event.type] ?? String(event.type ?? "EVT").toUpperCase();
  const color = colorFor(event);
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text><Text color={color} bold>{label}</Text><Text color={theme.fg.quiet}>  {event.name ?? event.timestamp ?? ""}</Text></Text>
      {wrapPlain(text, width - 4).map((line, i) => <Text key={i} color={event.type === "error" || event.type === "stderr" ? theme.state.danger : theme.fg.secondary}>│ {line}</Text>)}
    </Box>
  );
}

function windowEvents(events, transcript) {
  const offset = transcript?.offset ?? 0;
  const end = Math.max(0, events.length - offset);
  const start = Math.max(0, end - 40);
  return { visible: events.slice(start, end), hiddenBefore: start, hiddenAfter: Math.max(0, events.length - end), offset };
}

export function MessagePane({ events, width, height, transcript = { offset: 0, follow: true } }) {
  const transcriptOffset = transcript.offset ?? 0;
  const { visible, hiddenBefore, hiddenAfter, offset } = windowEvents(events, { ...transcript, offset: transcriptOffset });
  return (
    <Box flexDirection="column" height={height} overflow="hidden">
      {(hiddenBefore > 0 || hiddenAfter > 0) && <Text color={theme.fg.quiet}>PgUp/PgDn scroll · End follows latest · offset {offset} · {hiddenBefore} earlier events hidden · {hiddenAfter} newer</Text>}
      {visible.length === 0 && <Box flexDirection="column">
        <Text color={theme.fg.tertiary}>No mission submitted yet.</Text>
        <Text color={theme.fg.quiet}>Use the run input below to start with a repo audit, failing test trace, or patch review.</Text>
      </Box>}
      {visible.map((event, index) => {
        if (event.type === "separator") return <Separator key={index} label={event.label} width={width} />;
        if (event.type === "diff") return <DiffBlock key={index} diff={event.diff ?? event.text ?? ""} width={width} />;
        if (event.type === "tree") return <FileTree key={index} tree={event.tree} />;
        if (event.type === "command") return <CommandBlock key={index} event={event} width={width} />;
        return <TextEvent key={index} event={event} width={width} />;
      })}
    </Box>
  );
}
