import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { theme } from "../theme.js";

function logo() {
  return [
    " █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗ ███████╗ ██████╗ ██╗   ██╗███╗   ██╗██████╗ ██████╗ ██╗   ██╗",
    "██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗██╔════╝██╔═══██╗██║   ██║████╗  ██║██╔══██╗██╔══██╗╚██╗ ██╔╝",
    "███████║██║     ██████╔╝███████║███████║█████╗  ██║   ██║██║   ██║██╔██╗ ██║██║  ██║██████╔╝ ╚████╔╝ ",
    "██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║██╔══╝  ██║   ██║██║   ██║██║╚██╗██║██║  ██║██╔══██╗  ╚██╔╝  ",
    "██║  ██║███████╗██║     ██║  ██║██║  ██║██║     ╚██████╔╝╚██████╔╝██║ ╚████║██████╔╝██║  ██║   ██║   ",
    "╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝      ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝   ╚═╝   ",
  ];
}

export function Home({ state, columns, rows, onSubmit }) {
  const [value, setValue] = useState("");
  const boxWidth = Math.min(84, Math.max(52, Math.floor(columns * 0.74)));
  const topSpace = Math.max(1, Math.floor(rows * 0.1));

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <Box height={topSpace} />
      <Box flexDirection="column" alignItems="center">
        {logo().map((line, index) => (
          <Text key={index} color={theme.text} bold>{line}</Text>
        ))}
      </Box>
      <Box height={2} />
      <Box justifyContent="center">
        <Box width={boxWidth} borderStyle="round" borderColor={theme.border} paddingX={2} paddingY={1} flexDirection="column">
          <Box>
            <Text color={theme.muted}>Ask AlphaFoundry... </Text>
            <TextInput value={value} onChange={setValue} onSubmit={(input) => input.trim() && onSubmit(input.trim())} placeholder={'"Inspect this repo and improve the agent"'} />
          </Box>
          <Box marginTop={1}>
            <Text color={theme.muted}>{state.mode}   </Text>
            <Text color={theme.text} bold>{state.provider}/{state.model}</Text>
            <Text color={theme.muted}>   backend {state.runtime.backendPackage}@{state.runtime.backendVersion}</Text>
          </Box>
          <Box marginTop={1} justifyContent="center">
            <Text color={theme.muted}>Pi Agent backend   real project data   ctrl+c exit</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
