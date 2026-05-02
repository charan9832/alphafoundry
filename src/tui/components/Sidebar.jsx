import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { theme } from "../theme.js";
import { summarizeSafety } from "../safety.js";

function TaskIcon({ status }) {
  if (status === "done") return <Text color={theme.green}>[v]</Text>;
  if (status === "active") return <Text color={theme.cyan}>[<Spinner type="dots" />]</Text>;
  return <Text color={theme.muted}>[ ]</Text>;
}

export function Sidebar({ state, width }) {
  const safety = summarizeSafety(state);
  return (
    <Box flexDirection="column" width={width}>
      <Text bold color={theme.text}>{state.goal || "AlphaFoundry workspace"}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Runtime</Text>
        <Text color={theme.text}>{state.product} v{state.version}</Text>
        <Text color={theme.muted}>Node {state.runtime.nodeVersion}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Backend</Text>
        <Text color={state.mcp.connected ? theme.green : theme.red}>{state.runtime.backendPackage}</Text>
        <Text color={theme.muted}>v{state.runtime.backendVersion}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Project</Text>
        <Text color={theme.text}>{state.project.gitBranch}</Text>
        <Text color={state.project.gitDirty ? theme.yellow : theme.green}>{state.project.gitDirty ? "local changes" : "clean tree"}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Usage</Text>
        <Text color={theme.text}>{state.tokenUsage.tokens.toLocaleString()} tokens observed</Text>
        <Text color={theme.muted}>{state.tokenUsage.percent}% tracked · {state.tokenUsage.cost}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Session</Text>
        <Text color={theme.text}>{state.session?.id ?? "new"}</Text>
        <Text color={theme.muted}>{state.terminalState ?? state.status}{state.activeRun ? " · active run" : ""}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Intent</Text>
        <Text color={state.intent?.prompt ? theme.text : theme.muted}>{state.intent?.prompt ?? "none submitted"}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Evidence</Text>
        {state.evidence.length ? state.evidence.slice(-3).map((item, index) => <Text key={`${item.evidenceId ?? item.uri ?? item.title ?? "evidence"}-${index}`} color={theme.text}>• {item.title ?? item.kind ?? "runtime evidence"}</Text>) : <Text color={theme.muted}>none observed</Text>}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Safety</Text>
        <Text color={safety.tone === "pending" ? theme.yellow : safety.tone === "approved" ? theme.green : theme.muted}>{safety.short}</Text>
        <Text color={theme.muted}>{safety.detail}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Tools</Text>
        {state.tools?.length ? state.tools.map((tool) => <Text key={tool} color={theme.text}>• {tool}</Text>) : <Text color={theme.muted}>none enabled</Text>}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Language tools</Text>
        {state.lsp.length ? state.lsp.map((server) => <Text key={server} color={theme.text}>• {server}</Text>) : <Text color={theme.muted}>none detected</Text>}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Tasks</Text>
        {state.tasks.length ? state.tasks.map((task) => (
          <Box key={task.id}>
            <TaskIcon status={task.status} />
            <Text> </Text>
            <Text color={task.status === "pending" ? theme.muted : theme.text}>{task.label}</Text>
          </Box>
        )) : <Text color={theme.muted}>waiting for prompt</Text>}
      </Box>
    </Box>
  );
}
