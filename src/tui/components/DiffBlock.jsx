import React from "react";
import { Box, Text } from "ink";
import { formatDiffLines } from "../formatters.js";
import { theme } from "../theme.js";

export function DiffBlock({ diff, width }) {
  const lines = formatDiffLines(diff, width);
  return (
    <Box flexDirection="column" marginBottom={1}>
      {lines.map((line, index) => {
        const color = line.kind === "add" ? theme.green : line.kind === "remove" ? theme.deletion : line.kind === "hunk" ? theme.cyan : theme.muted;
        return <Text key={index} color={color} dimColor={line.kind === "remove"}>{line.text}</Text>;
      })}
    </Box>
  );
}
