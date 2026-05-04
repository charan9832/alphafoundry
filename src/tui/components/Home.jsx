import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { theme } from "../theme.js";
import { commandSuggestions } from "../commands.js";

// ── Character logo ──────────────────────────────────────────
const LOGO = [
  "  ╭╮",
  "  ╰╮╭╮ ╮ ╭",
  "   ╰╯╰╯╰─╯",
];

const capabilityChips = ["Sessions", "Pre-run approval", "Diffs", "Evidence"];

function setupLines(state) {
  if (!state.setupStatus || state.setupStatus.level === "ready") return [];
  return [
    state.setupStatus.message ?? "Setup needs attention",
    "Type /onboard to configure provider, model, and credentials.",
    "Type /doctor for detailed health checks.",
  ];
}

function CommandSuggestions({ input }) {
  const items = commandSuggestions(input);
  if (!String(input ?? "").startsWith("/") || !items.length) return null;
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={theme.fg.quiet}>Tab complete · suggestions</Text>
      {items.slice(0, 5).map((item) => (
        <Text key={item.command} color={theme.fg.tertiary}>
          /{item.command}  {item.description}  {item.hint}
        </Text>
      ))}
    </Box>
  );
}

export function Home({ state, dispatch, columns, rows, onSubmit }) {
  const boxWidth = Math.min(88, Math.max(34, Math.floor(columns * 0.72)));
  const leftPad = Math.max(0, Math.floor((columns - boxWidth) / 2));
  const topSpace = Math.max(1, Math.floor(rows * 0.1));
  const setup = setupLines(state);

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <Box height={topSpace} />
      <Box paddingLeft={leftPad} flexDirection="column">
        {/* Logo mark — centered offset */}
        {LOGO.map((line, i) => (
          <Text key={i} color={theme.accent.brand}>{line}</Text>
        ))}
        <Box marginTop={1}>
          <Text color={theme.fg.primary} bold>AlphaFoundry</Text>
        </Box>
        <Text color={theme.fg.secondary}>terminal workspace for agentic software work</Text>
        <Box marginTop={1}>
          <Text color={theme.fg.tertiary}>Plan changes · Gate tools · Track evidence · Durable sessions</Text>
        </Box>
      </Box>
      <Box height={1} />
      <Box justifyContent="center">
        <Box
          width={boxWidth}
          borderStyle="round"
          borderColor={setup.length ? theme.state.warning : theme.surface.border}
          paddingX={2}
          paddingY={1}
          flexDirection="column"
        >
          <Box marginBottom={1}>
            <Text color={setup.length ? theme.state.warning : theme.fg.secondary} bold>
              {setup.length ? "Setup required" : "Start a workspace run"}
            </Text>
          </Box>

          {setup.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              {setup.map((line) => (
                <Text key={line} color={line.startsWith("Type /") ? theme.fg.secondary : theme.fg.tertiary}>
                  {line}
                </Text>
              ))}
            </Box>
          )}

          <Box>
            <Text color={theme.fg.tertiary}>af › </Text>
            <TextInput
              value={state.input ?? ""}
              onChange={(value) => dispatch({ type: "SET_INPUT", value })}
              onSubmit={(input) => input.trim() && onSubmit(input.trim())}
              placeholder={'Type a prompt or / command'}
            />
          </Box>

          <CommandSuggestions input={state.input} />

          <Box marginTop={1}>
            <Text color={theme.fg.quiet}>Mode </Text>
            <Text color={theme.fg.secondary}>{state.permissionMode ?? state.mode}</Text>
            <Text color={theme.fg.quiet}> · </Text>
            <Text color={theme.fg.secondary}>{state.provider}/{state.model}</Text>
            <Text color={theme.fg.quiet}> · </Text>
            <Text color={theme.fg.secondary}>{state.session?.id ?? "new"}</Text>
          </Box>

          <Box marginTop={1}>
            {capabilityChips.map((chip, index) => (
              <Text key={chip} color={theme.fg.tertiary}>
                {index > 0 ? " · " : ""}{chip}
              </Text>
            ))}
          </Box>
        </Box>
      </Box>
      <Box height={1} />
      <Box paddingLeft={leftPad}>
        <Text color={theme.fg.quiet}>Enter to submit · /help for commands · Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}