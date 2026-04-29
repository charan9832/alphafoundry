import React from "react";
import { Box, Text } from "ink";
import stringWidth from "string-width";
import { theme } from "../theme.js";

function fit(text, width) {
  if (stringWidth(text) <= width) return text;
  if (width <= 1) return "";
  return text.slice(0, Math.max(0, width - 1)) + "…";
}

export function StatusBar({ state, width }) {
  const left = `${state.product}  ${state.provider}/${state.model}`;
  const center = state.action || "ready";
  const right = `${state.cwd}  v${state.version}`;
  const leftWidth = Math.floor(width * 0.33);
  const centerWidth = Math.floor(width * 0.34);
  const rightWidth = width - leftWidth - centerWidth;
  return (
    <Box width={width}>
      <Box width={leftWidth}><Text color={theme.text} bold>{fit(left, leftWidth)}</Text></Box>
      <Box width={centerWidth} justifyContent="center"><Text color={state.status === "running" ? theme.cyan : theme.muted}>{fit(center, centerWidth)}</Text></Box>
      <Box width={rightWidth} justifyContent="flex-end"><Text color={theme.muted}>{fit(right, rightWidth)}</Text></Box>
    </Box>
  );
}
