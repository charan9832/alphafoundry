import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { summarizeSafety } from "../safety.js";

function row(label, value, valueColor = theme.fg.secondary) {
  return (
    <Box>
      <Text color={theme.fg.tertiary}>{label}</Text>
      <Text> </Text>
      <Text color={valueColor}>{value}</Text>
    </Box>
  );
}

function maybeGitTrunc(value, max = 28) {
  if (!value || value === "no git") return "—";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function trunc(value, max = 28) {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function Section({ label, children }) {
  return (
    <Box marginTop={1} flexDirection="column">
      <Box marginBottom={0}>
        <Text color={theme.fg.quiet}>{label.toUpperCase()}</Text>
      </Box>
      {children}
    </Box>
  );
}

export function Sidebar({ state, width }) {
  const safety = summarizeSafety(state);
  const safetyColor =
    safety.tone === "pending" ? theme.state.warning
    : safety.tone === "approved" ? theme.state.success
    : theme.fg.tertiary;
  const treeColor = state.project?.gitDirty ? theme.state.warning : theme.state.success;

  const compactLabel = `${state.provider}/${state.model}`;
  const sessionLabel = state.session?.id?.length > 12
    ? state.session.id.slice(0, 12) + "…"
    : state.session?.id ?? "—";

  return (
    <Box flexDirection="column" width={width}>
      {/* ── Title ─────────────────────────────────────────── */}
      <Text bold color={theme.fg.primary}>
        {trunc(state.goal || "Workspace", Math.max(16, width))}
      </Text>

      {/* ── State ──────────────────────────────────────────── */}
      <Section label="State">
        {row("Status", state.terminalState ?? state.status ?? "idle",
          state.status === "error" ? theme.state.danger
          : state.status === "running" ? theme.state.running
          : theme.fg.secondary)}
        {row("Model", trunc(compactLabel, width - 10))}
        {row("Session", sessionLabel, theme.fg.tertiary)}
      </Section>

      {/* ── Policy ─────────────────────────────────────────── */}
      <Section label="Policy">
        {row("Mode", state.permissionMode ?? state.mode ?? "ask")}
        {row("Guard", trunc(safety.short, width - 10), safetyColor)}
      </Section>

      {/* ── Evidence ───────────────────────────────────────── */}
      <Section label="Evidence">
        {state.evidence?.length > 0
          ? state.evidence.slice(-3).map((item, i) => (
              <Text key={`ev-${i}`} color={theme.fg.secondary}>
                · {trunc(item.title ?? item.kind ?? "runtime evidence", Math.max(12, width - 4))}
              </Text>
            ))
          : <Text color={theme.fg.tertiary}>—</Text>}
      </Section>

      {/* ── Project ────────────────────────────────────────── */}
      <Section label="Project">
        {row("Branch", maybeGitTrunc(state.project?.gitBranch, Math.max(12, width - 10)))}
        {row("Tree", state.project?.gitDirty ? "modified" : "clean", treeColor)}
        {row("Cwd", trunc(state.cwd, Math.max(12, width - 8)), theme.fg.tertiary)}
      </Section>

      {/* ── Tools ──────────────────────────────────────────── */}
      <Section label="Tools">
        {state.tools?.length > 0
          ? <Text color={theme.fg.secondary}>{trunc(state.tools.join(", "), Math.max(12, width - 2))}</Text>
          : <Text color={theme.fg.tertiary}>—</Text>}
      </Section>

      {/* ── Usage ──────────────────────────────────────────── */}
      <Section label="Usage">
        {row("Tokens", state.tokenUsage?.tokens?.toLocaleString() ?? "0")}
        {row("Cost", `${state.tokenUsage?.percent ?? 0}% · ${state.tokenUsage?.cost ?? "$0.00"}`, theme.fg.tertiary)}
      </Section>
    </Box>
  );
}