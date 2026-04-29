import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { MessagePane } from "./MessagePane.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { StatusBar } from "./StatusBar.jsx";
import { theme } from "../theme.js";

export function Workspace({ state, columns, rows, mainWidth, sidebarWidth, onSubmit }) {
  const [value, setValue] = useState("");
  const contentHeight = Math.max(8, rows - 3);
  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <Box flexDirection="row" height={contentHeight}>
        <Box width={mainWidth} paddingRight={1} flexDirection="column">
          <MessagePane events={state.events} width={mainWidth - 2} height={contentHeight - 4} />
          <Box borderStyle="single" borderColor={theme.border} paddingX={1}>
            <Text color={theme.cyan}>› </Text>
            <TextInput value={value} onChange={setValue} onSubmit={(input) => { const clean = input.trim(); if (!clean) return; setValue(""); onSubmit(clean); }} placeholder="Ask AlphaFoundry..." />
          </Box>
        </Box>
        <Box width={1}><Text color={theme.border}>│</Text></Box>
        <Box width={sidebarWidth} paddingLeft={1}><Sidebar state={state} width={sidebarWidth - 2} /></Box>
      </Box>
      <StatusBar state={state} width={columns} />
    </Box>
  );
}
