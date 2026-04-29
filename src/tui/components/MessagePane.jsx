import React from "react";
import { Box, Text } from "ink";
import { DiffBlock } from "./DiffBlock.jsx";
import { FileTree } from "./FileTree.jsx";
import { CommandBlock } from "./CommandBlock.jsx";
import { wrapPlain } from "../formatters.js";
import { theme } from "../theme.js";

function Separator({ label, width }) {
  const text = label ? ` ${label} ` : "";
  const left = Math.max(1, Math.floor((width - text.length) / 2));
  const right = Math.max(1, width - left - text.length);
  return <Text color={theme.border}>{"─".repeat(left)}{text}{"─".repeat(right)}</Text>;
}

function TextEvent({ event, width }) {
  const color = event.type === "user" ? theme.cyan : event.type === "error" ? theme.red : theme.text;
  const label = event.type === "user" ? "you" : event.type === "assistant" ? "assistant" : event.type;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={color} bold>▸ {label}</Text>
      {wrapPlain(event.text ?? "", width - 2).map((line, i) => <Text key={i} color={event.type === "error" ? theme.red : theme.text}>{line}</Text>)}
    </Box>
  );
}

export function MessagePane({ events, width, height }) {
  const visible = events.slice(-40);
  return (
    <Box flexDirection="column" height={height} overflow="hidden">
      {visible.map((event, index) => {
        if (event.type === "separator") return <Separator key={index} label={event.label} width={width} />;
        if (event.type === "diff") return <DiffBlock key={index} diff={event.diff} width={width} />;
        if (event.type === "tree") return <FileTree key={index} tree={event.tree} />;
        if (event.type === "command") return <CommandBlock key={index} event={event} width={width} />;
        return <TextEvent key={index} event={event} width={width} />;
      })}
    </Box>
  );
}
