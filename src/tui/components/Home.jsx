import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { theme } from "../theme.js";

const capabilityChips = ["Session records", "Pre-run tool approval", "Diff display", "Evidence when emitted"];

function setupLines(state) {
  if (!state.setupStatus || state.setupStatus.level === "ready") return [];
  return [
    state.setupStatus.message ?? "Setup needs attention before runtime prompts.",
    "Run af onboard to configure provider, model, and credentials.",
    "Run af doctor for detailed local health checks.",
  ];
}

export function Home({ state, dispatch, columns, rows, onSubmit }) {
  const boxWidth = Math.min(96, Math.max(34, Math.floor(columns * 0.78)));
  const leftPad = Math.max(0, Math.floor((columns - boxWidth) / 2));
  const topSpace = Math.max(1, Math.floor(rows * 0.12));
  const setup = setupLines(state);

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <Box height={topSpace} />
      <Box paddingLeft={leftPad} flexDirection="column">
        <Text color={theme.fg.tertiary}>ALPHAFOUNDRY</Text>
        <Text color={theme.fg.primary} bold>terminal workspace for agentic software work</Text>
        <Text color={theme.fg.tertiary}>Plan changes, gate tools, track evidence, and keep durable sessions.</Text>
      </Box>
      <Box height={1} />
      <Box justifyContent="center">
        <Box width={boxWidth} borderStyle="round" borderColor={setup.length ? theme.state.warning : theme.accent.brand} paddingX={2} paddingY={1} flexDirection="column">
          <Box marginBottom={1}>
            <Text color={setup.length ? theme.state.warning : theme.accent.brand} bold>{setup.length ? "Setup required " : "Start a workspace run "}</Text>
            <Text color={theme.fg.quiet}>/ run input</Text>
          </Box>
          {setup.length ? <Box flexDirection="column" marginBottom={1}>
            {setup.map((line) => <Text key={line} color={line.startsWith("Run af") ? theme.fg.secondary : theme.fg.tertiary}>{line}</Text>)}
          </Box> : null}
          <Box>
            <Text color={theme.fg.secondary}>af › </Text>
            <TextInput value={state.input ?? ""} onChange={(value) => dispatch({ type: "SET_INPUT", value })} onSubmit={(input) => input.trim() && onSubmit(input.trim())} placeholder={'"Audit this repo and propose the safest next change"'} />
          </Box>
          <Box marginTop={1}>
            <Text color={theme.fg.quiet}>Mode </Text>
            <Text color={theme.fg.primary}>{state.permissionMode ?? state.mode}</Text>
            <Text color={theme.fg.quiet}> · Model </Text>
            <Text color={theme.fg.primary}>{state.provider}/{state.model}</Text>
            <Text color={theme.fg.quiet}> · Session </Text>
            <Text color={theme.fg.secondary}>{state.session?.id ?? "new"}</Text>
          </Box>
          <Box marginTop={1}>
            {capabilityChips.map((chip, index) => (
              <Text key={chip} color={chip === "Pre-run tool approval" ? theme.state.warning : theme.fg.tertiary}>{index ? "  ·  " : ""}{chip}</Text>
            ))}
          </Box>
        </Box>
      </Box>
      <Box height={1} />
      <Box paddingLeft={leftPad}>
        <Text color={theme.fg.quiet}>Enter submits · /help opens commands · Ctrl+C exits</Text>
      </Box>
    </Box>
  );
}
