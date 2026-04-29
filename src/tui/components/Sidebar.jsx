import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { theme } from "../theme.js";

function TaskIcon({ status }) {
  if (status === "done") return <Text color={theme.green}>[v]</Text>;
  if (status === "active") return <Text color={theme.cyan}>[<Spinner type="dots" />]</Text>;
  return <Text color={theme.muted}>[ ]</Text>;
}

export function Sidebar({ state, width }) {
  return (
    <Box flexDirection="column" width={width}>
      <Text bold color={theme.text}>{state.goal || "No active goal"}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Context</Text>
        <Text color={theme.text}>{state.tokenUsage.tokens.toLocaleString()} tokens</Text>
        <Text color={theme.muted}>{state.tokenUsage.percent}% used</Text>
        <Text color={theme.muted}>{state.tokenUsage.cost} spent</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>MCP</Text>
        <Text color={state.mcp.connected ? theme.green : theme.red}>{state.mcp.label} {state.mcp.connected ? "Connected" : "Disconnected"}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>LSP</Text>
        {state.lsp.map((server) => <Text key={server} color={theme.text}>• {server}</Text>)}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Tasks</Text>
        {state.tasks.map((task) => (
          <Box key={task.id}>
            <TaskIcon status={task.status} />
            <Text> </Text>
            <Text color={task.status === "pending" ? theme.muted : theme.text}>{task.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
