import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export function FileTree({ tree }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {tree.map((node, index) => (
        <Text key={index}>
          <Text color={theme.muted}>{node.prefix}</Text>
          <Text color={node.type === "dir" ? theme.text : theme.muted} bold={node.type === "dir"}>{node.name}</Text>
        </Text>
      ))}
    </Box>
  );
}
