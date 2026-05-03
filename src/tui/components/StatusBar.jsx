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
  if (safety.tone === "pending") return { text: "● tool approval pending", color: theme.state.warning, hint: "approve allowlist: /approve-tools" };
  if (state.status === "running") return { text: "● running", color: theme.state.running, hint: "running — Esc cancels" };
  if (state.status === "cancelling") return { text: "● cancelling", color: theme.state.warning, hint: "running — Esc cancels" };
  if (state.status === "error") return { text: "● error", color: theme.state.danger, hint: "exit and run af doctor" };
  if (state.terminalState === "success") return { text: "● complete", color: theme.state.success, hint: state.action || "ready" };
  return { text: "● ready", color: theme.state.success, hint: state.action || "ready" };
}

export function StatusBar({ state, width }) {
  const safety = summarizeSafety(state);
  const run = stateLabel(state, safety);
  const left = `${state.product}  ${state.provider}/${state.model}`;
  const center = `${run.text}  ${run.hint}`;
  const right = `${safety.short}  ${state.session?.id ?? "new"}`;
  const leftWidth = Math.floor(width * 0.36);
  const centerWidth = Math.floor(width * 0.34);
  const rightWidth = width - leftWidth - centerWidth;
  return (
    <Box width={width}>
      <Box width={leftWidth}><Text color={theme.fg.primary} bold>{fit(left, leftWidth)}</Text></Box>
      <Box width={centerWidth} justifyContent="center"><Text color={run.color}>{fit(center, centerWidth)}</Text></Box>
      <Box width={rightWidth} justifyContent="flex-end"><Text color={theme.fg.tertiary}>{fit(right, rightWidth)}</Text></Box>
    </Box>
  );
}
