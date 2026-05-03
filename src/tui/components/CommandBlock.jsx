import React from "react";
import { Box, Text } from "ink";
import { wrapPlain } from "../formatters.js";
import { theme } from "../theme.js";

export function CommandBlock({ event, width }) {
  const success = event.status === "success";
  const failed = event.status === "error";
  const marker = success ? "[✓]" : failed ? "[x]" : event.status === "running" ? "[…]" : "[ ]";
  const color = success ? theme.state.success : failed ? theme.state.danger : theme.state.running;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text><Text color={color} bold>CMD</Text><Text color={theme.fg.quiet}> {marker} controlled execution</Text></Text>
      <Text color={theme.fg.secondary}>$ {event.command}</Text>
      {event.output && wrapPlain(event.output, width - 2).map((line, index) => <Text key={index} color={theme.fg.tertiary}>│ {line}</Text>)}
      {event.status === "running" && <Text color={theme.state.running}>running...</Text>}
    </Box>
  );
}
