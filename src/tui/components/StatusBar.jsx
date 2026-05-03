import React from "react";
import { Box, Text } from "ink";
import stringWidth from "string-width";
import { theme } from "../theme.js";
import { summarizeSafety } from "../safety.js";

function fit(text, width) {
  if (stringWidth(text) <= width) return text;
  if (width <= 1) return "";
  return text.slice(0, Math.max(0, width - 1)) + "…";
}

function stateLabel(state, safety) {
  if (safety.tone === "pending")
    return { text: "● pending", color: theme.state.warning, hint: "/approve-tools" };
  if (state.status === "running")
    return { text: "● running", color: theme.state.running, hint: "Esc to cancel" };
  if (state.status === "cancelling")
    return { text: "○ cancelling", color: theme.state.warning, hint: "Esc to cancel" };
  if (state.status === "error")
    return { text: "● error", color: theme.state.danger, hint: "/doctor for help" };
  if (state.terminalState === "success")
    return { text: "✓ ready", color: theme.state.success, hint: state.action || "ready" };
  return { text: "✓ ready", color: theme.state.success, hint: state.action || "ready" };
}

export function StatusBar({ state, width }) {
  const safety = summarizeSafety(state);
  const run = stateLabel(state, safety);

  // Three-segment rail: product | state + hint | session + mode
  const left = `AlphaFoundry  ${state.provider}/${state.model}`;
  const center = `${run.text}  ${run.hint}`;
  const right = `ses:${state.session?.id?.slice(0, 18) ?? "new"}  mode:${state.permissionMode ?? state.mode}`;

  const leftW = Math.floor(width * 0.38);
  const centerW = Math.floor(width * 0.32);
  const rightW = width - leftW - centerW;

  return (
    <Box width={width} height={1} paddingLeft={1} paddingRight={1}>
      <Box width={leftW}>
        <Text bold color={theme.fg.primary}>{fit(left, leftW)}</Text>
      </Box>
      <Box width={centerW} justifyContent="center">
        <Text color={run.color}>{fit(center, centerW)}</Text>
      </Box>
      <Box width={rightW} justifyContent="flex-end">
        <Text color={theme.fg.tertiary}>{fit(right, rightW)}</Text>
      </Box>
    </Box>
  );
}