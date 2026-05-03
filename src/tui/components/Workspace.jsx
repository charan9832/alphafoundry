import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { MessagePane } from "./MessagePane.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { StatusBar } from "./StatusBar.jsx";
import { theme } from "../theme.js";
import { summarizeSafety } from "../safety.js";
import { commandSuggestions } from "../commands.js";

function promptBorder(state, safety) {
  if (safety.tone === "pending") return theme.state.warning;
  if (state.status === "running" || state.status === "cancelling") return theme.state.running;
  if (state.status === "error") return theme.state.danger;
  return theme.accent.brand;
}

function promptPlaceholder(state, safety) {
  if (safety.tone === "pending") return "/approve-tools to continue, or revise request";
  if (state.status === "running" || state.status === "cancelling") return "Runtime request running — Esc to cancel";
  if (state.status === "error") return "Fix config, retry, or exit and run af doctor";
  return "Describe the change, investigation, or review...";
}

function CommandSuggestions({ input, suggestions }) {
  const items = suggestions?.length ? suggestions : commandSuggestions(input);
  if (!String(input ?? "").startsWith("/") || !items.length) return null;
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={theme.fg.quiet}>Tab complete · command suggestions</Text>
      {items.slice(0, 5).map((item) => <Text key={item.command} color={theme.fg.tertiary}>/{item.command}  {item.description}  {item.hint}</Text>)}
    </Box>
  );
}

export function Workspace({ state, dispatch, columns, rows, mainWidth, sidebarWidth, showSidebar = true, onSubmit }) {
  const safety = summarizeSafety(state);
  const contentHeight = Math.max(8, rows - 4);
  const paneWidth = Math.max(20, mainWidth);
  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <StatusBar state={state} width={columns} />
      <Box flexDirection="row" height={contentHeight}>
        <Box width={paneWidth} paddingRight={showSidebar ? 1 : 0} flexDirection="column">
          <MessagePane events={state.events} width={paneWidth - 2} height={contentHeight - 7} transcript={state.transcript} />
          <Box borderStyle="round" borderColor={promptBorder(state, safety)} paddingX={1} flexDirection="column">
            <Box>
              <Text color={theme.fg.quiet}>RUN </Text>
              <Text color={theme.accent.brand}>af › </Text>
              <TextInput value={state.input ?? ""} onChange={(value) => dispatch({ type: "SET_INPUT", value })} onSubmit={(input) => { const clean = input.trim(); if (!clean) return; onSubmit(clean); }} placeholder={promptPlaceholder(state, safety)} />
            </Box>
            <Box>
              <Text color={theme.fg.quiet}>policy </Text>
              <Text color={safety.tone === "pending" ? theme.state.warning : safety.tone === "approved" ? theme.state.success : theme.fg.tertiary}>{safety.short}</Text>
              <Text color={theme.fg.quiet}> · Enter submit · Esc cancel · /help</Text>
            </Box>
            <CommandSuggestions input={state.input} suggestions={state.commandSuggestions} />
          </Box>
        </Box>
        {showSidebar ? <Box width={1}><Text color={theme.surface.subtleBorder}>│</Text></Box> : null}
        {showSidebar ? <Box width={sidebarWidth} paddingLeft={1}><Sidebar state={state} width={sidebarWidth - 2} /></Box> : null}
      </Box>
    </Box>
  );
}
