import React from "react";
import { Box, Text } from "ink";
import { DiffBlock } from "./DiffBlock.jsx";
import { FileTree } from "./FileTree.jsx";
import { CommandBlock } from "./CommandBlock.jsx";
import { wrapPlain } from "../formatters.js";
import { theme } from "../theme.js";

// ── Role label map ──────────────────────────────────────────
const labels = {
  user: "You",
  assistant: "AF",
  system: "sys",
  tool: "tool",
  stdout: "out",
  stderr: "err",
  error: "err",
  stats: "usage",
  session: "session",
  artifact: "artifact",
  command: "cmd",
  diff: "diff",
  tree: "tree",
};

function roleColor(event) {
  if (event.type === "user") return theme.role.user;
  if (event.type === "assistant") return theme.role.assistant;
  if (event.type === "error" || event.type === "stderr") return theme.role.error;
  if (event.type === "tool" || event.type === "command") return theme.role.tool;
  if (event.type === "artifact") return theme.state.success;
  if (event.type === "diff") return theme.diff.hunk;
  return theme.fg.tertiary;
}

function Separator({ label, width }) {
  const text = ` ${String(label ?? "EVENTS").toUpperCase()} `;
  const side = Math.max(1, Math.floor((width - text.length) / 2));
  return <Text color={theme.surface.subtle}>{'─'.repeat(side)}{text}{'─'.repeat(width - side - text.length)}</Text>;
}

function TextEvent({ event, width }) {
  const text = event.text ?? event.output ?? event.error ?? "";
  const label = labels[event.type] ?? String(event.type ?? "evt").toUpperCase();
  const color = roleColor(event);
  const meta = event.name ?? event.timestamp ?? "";
  const bodyWidth = Math.max(10, width - 4);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={color}>{label}</Text>
        {meta && <Text> <Text color={theme.fg.tertiary}>{meta}</Text></Text>}
      </Box>
      {wrapPlain(text, bodyWidth).map((line, i) => (
        <Box key={i}>
          <Text color={theme.surface.subtle}>│ </Text>
          <Text color={event.type === "error" || event.type === "stderr" ? theme.role.error : theme.fg.secondary}>{line}</Text>
        </Box>
      ))}
    </Box>
  );
}

function windowEvents(events, transcript) {
  const offset = transcript?.offset ?? 0;
  const end = Math.max(0, events.length - offset);
  const start = Math.max(0, end - 40);
  return {
    visible: events.slice(start, end),
    hiddenBefore: start,
    hiddenAfter: Math.max(0, events.length - end),
    offset,
  };
}

export function MessagePane({ events, width, height, transcript = { offset: 0, follow: true } }) {
  const transcriptOffset = transcript.offset ?? 0;
  const { visible, hiddenBefore, hiddenAfter, offset } = windowEvents(events, {
    ...transcript,
    offset: transcriptOffset,
  });

  return (
    <Box flexDirection="column" height={height} overflow="hidden">
      {/* ── Scroll hint ──────────────────────────────────── */}
      {(hiddenBefore > 0 || hiddenAfter > 0) && (
        <Text color={theme.fg.tertiary}>
          offset:{offset} · +{hiddenBefore} hidden · {hiddenAfter} newer · PgUp/PgDn scroll · End latest
        </Text>
      )}

      {/* ── Empty state ──────────────────────────────────── */}
      {visible.length === 0 && (
        <Box flexDirection="column">
          <Text color={theme.fg.secondary}>No messages yet.</Text>
          <Text color={theme.fg.tertiary}>
            Type a prompt below to start.
          </Text>
        </Box>
      )}

      {/* ── Event list ───────────────────────────────────── */}
      {visible.map((event, index) => {
        if (event.type === "separator")
          return <Separator key={index} label={event.label} width={width} />;
        if (event.type === "diff")
          return <DiffBlock key={index} diff={event.diff ?? event.text ?? ""} width={width} />;
        if (event.type === "tree")
          return <FileTree key={index} tree={event.tree} />;
        if (event.type === "command")
          return <CommandBlock key={index} event={event} width={width} />;
        return <TextEvent key={index} event={event} width={width} />;
      })}
    </Box>
  );
}