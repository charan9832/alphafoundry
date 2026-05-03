import React from "react";
import { Box, Text } from "ink";
import { formatDiffLines } from "../formatters.js";
import { theme } from "../theme.js";

export function DiffBlock({ diff, width }) {
  const lines = formatDiffLines(diff, width);
  const added = lines.filter((line) => line.kind === "add").length;
  const removed = lines.filter((line) => line.kind === "remove").length;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text><Text color={theme.diff.hunk} bold>DIFF</Text><Text color={theme.fg.quiet}> +{added} -{removed}</Text></Text>
      {lines.map((line, index) => {
        const color = line.kind === "add" ? theme.diff.add : line.kind === "remove" ? theme.diff.remove : line.kind === "hunk" ? theme.diff.hunk : theme.diff.meta;
        return <Text key={index} color={color} dimColor={line.kind === "remove"}>{line.text}</Text>;
      })}
    </Box>
  );
}
