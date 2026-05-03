import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { summarizeSafety } from "../safety.js";

function row(label, value, color = theme.fg.secondary) {
  return <Text><Text color={theme.fg.quiet}>{label.padEnd(7)} </Text><Text color={color}>{value}</Text></Text>;
}

function truncate(value, max = 36) {
  if (!value) return "none";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function Section({ title, children, tone = theme.fg.tertiary }) {
  return (
    <Box marginTop={1} flexDirection="column">
      <Text color={tone}>{title.toUpperCase()}</Text>
      {children}
    </Box>
  );
}

export function Sidebar({ state, width }) {
  const safety = summarizeSafety(state);
  const safetyColor = safety.tone === "pending" ? theme.state.warning : safety.tone === "approved" ? theme.state.success : theme.fg.tertiary;
  const treeColor = state.project.gitDirty ? theme.state.warning : theme.state.success;
  return (
    <Box flexDirection="column" width={width}>
      <Text bold color={theme.fg.primary}>{truncate(state.goal || "AlphaFoundry workspace", Math.max(20, width))}</Text>
      <Text color={theme.fg.quiet}>run context</Text>

      <Section title="Run context" tone={theme.accent.brand}>
        {row("Goal", truncate(state.intent?.prompt ?? "not submitted", Math.max(16, width - 8)), state.intent?.prompt ? theme.fg.secondary : theme.fg.quiet)}
        {row("Action", state.action ?? "ready", theme.fg.tertiary)}
      </Section>

      <Section title="Run">
        {row("State", state.terminalState ?? state.status, state.status === "error" ? theme.state.danger : state.status === "running" ? theme.state.running : theme.fg.secondary)}
        {row("Model", truncate(`${state.provider}/${state.model}`, Math.max(16, width - 8)), theme.fg.secondary)}
        {row("Session", state.session?.id ?? "new", theme.fg.tertiary)}
      </Section>

      <Section title="Tool policy" tone={safetyColor}>
        {row("Mode", state.permissionMode ?? state.mode, theme.fg.secondary)}
        {row("Guard", safety.short, safetyColor)}
        {row("Detail", truncate(safety.detail, Math.max(16, width - 8)), theme.fg.tertiary)}
      </Section>

      <Section title="Evidence">
        {state.evidence.length ? state.evidence.slice(-3).map((item, index) => <Text key={`${item.evidenceId ?? item.uri ?? item.title ?? "evidence"}-${index}`} color={theme.fg.secondary}>• {truncate(item.title ?? item.kind ?? "runtime evidence", Math.max(16, width - 3))}</Text>) : <Text color={theme.fg.quiet}>none observed</Text>}
      </Section>

      <Section title="Project">
        {row("Branch", truncate(state.project.gitBranch, Math.max(16, width - 8)), theme.fg.secondary)}
        {row("Tree", state.project.gitDirty ? "local changes" : "clean", treeColor)}
        {row("Cwd", truncate(state.cwd, Math.max(16, width - 8)), theme.fg.quiet)}
      </Section>

      <Section title="Tools">
        {state.tools?.length ? <Text color={theme.fg.secondary}>{truncate(state.tools.join(", "), Math.max(16, width - 2))}</Text> : <Text color={theme.fg.quiet}>none enabled</Text>}
      </Section>

      <Section title="Usage">
        {row("Tokens", state.tokenUsage.tokens.toLocaleString(), theme.fg.secondary)}
        {row("Cost", `${state.tokenUsage.percent}% · ${state.tokenUsage.cost}`, theme.fg.tertiary)}
      </Section>
    </Box>
  );
}
