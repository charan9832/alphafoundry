import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import stringWidth from "string-width";
import { theme } from "../theme.js";
import { summarizeSafety } from "../safety.js";

// ── Inline spinner frames (avoids ink-spinner peer dep issues) ──
const DOTS_FRAMES = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"];

function BrailleSpinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((p) => (p + 1) % DOTS_FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);
  return <Text>{DOTS_FRAMES[frame]}</Text>;
}

function fit(text, width) {
  if (stringWidth(text) <= width) return text;
  if (width <= 1) return "";
  return text.slice(0, Math.max(0, width - 1)) + "…";
}

function stateLabel(state, safety) {
  if (safety.tone === "pending")
    return { text: "pending", color: theme.state.warning, hint: "/approve-tools" };
  if (state.status === "running")
    return { text: "running", color: theme.state.running };
  if (state.status === "cancelling")
    return { text: "cancelling", color: theme.state.warning };
  if (state.status === "error")
    return { text: "error", color: theme.state.danger, hint: "/doctor" };
  if (state.terminalState === "success")
    return { text: "ready", color: theme.state.success, hint: state.action || "ready" };
  return { text: "ready", color: theme.state.success, hint: state.action || "ready" };
}

function ElapsedTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  return <Text> {elapsed}s</Text>;
}

export function StatusBar({ state, width, runStartedAt }) {
  const safety = summarizeSafety(state);
  const run = stateLabel(state, safety);

  const left = `AlphaFoundry  ${state.provider}/${state.model}`;
  const sessionLabel = state.session?.id?.slice(0, 18) ?? "new";
  const modeLabel = state.permissionMode ?? state.mode;
  const right = `ses:${sessionLabel}  mode:${modeLabel}`;

  const leftW = Math.floor(width * 0.38);
  const centerW = Math.floor(width * 0.32);
  const rightW = width - leftW - centerW;

  return (
    <Box width={width} height={1} paddingLeft={1} paddingRight={1}>
      <Box width={leftW}>
        <Text bold color={theme.fg.primary}>{fit(left, leftW)}</Text>
      </Box>
      <Box width={centerW} justifyContent="center">
        <Text color={run.color}>
          {state.status === "running" || state.status === "cancelling" ? (
            <>
              <BrailleSpinner />{" "}
            </>
          ) : null}
          {fit(run.text, 15)}
          {state.status === "running" && runStartedAt ? (
            <ElapsedTimer startedAt={runStartedAt} />
          ) : null}
        </Text>
      </Box>
      <Box width={rightW} justifyContent="flex-end">
        <Text color={theme.fg.tertiary}>{fit(right, rightW)}</Text>
      </Box>
    </Box>
  );
}