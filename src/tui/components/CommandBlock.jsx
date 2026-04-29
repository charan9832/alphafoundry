import React from "react";
import { Box, Text } from "ink";
import { wrapPlain } from "../formatters.js";
import { theme } from "../theme.js";

export function CommandBlock({ event, width }) {
  const success = event.status === "success";
  const failed = event.status === "error";
  const marker = success ? "[✓]" : failed ? "[x]" : "[ ]";
  const color = success ? theme.green : failed ? theme.red : theme.cyan;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={color}>{marker} $ {event.command}</Text>
      {event.output && wrapPlain(event.output, width - 2).map((line, index) => <Text key={index} color={theme.muted}>{line}</Text>)}
      {event.status === "running" && <Text color={theme.cyan}>running...</Text>}
    </Box>
  );
}
