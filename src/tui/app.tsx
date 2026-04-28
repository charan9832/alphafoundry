import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import type { AppConfig } from "../types.js";
import { respondToMessage } from "../agent/runtime.js";
import { createSessionId } from "../sessions.js";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function App({ config }: { config: AppConfig }) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [sessionId] = useState(() => createSessionId());

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || processing) return;
      if (text.trim() === "/quit") {
        exit();
        return;
      }
      if (text.trim() === "/clear") {
        setMessages([]);
        setInput("");
        return;
      }
      if (text.trim() === "/help") {
        setMessages((prev) => [...prev, { role: "assistant", content: "Commands: /help, /clear, /quit. Try: check readiness, search the web for recent AI agent news, create project." }]);
        setInput("");
        return;
      }
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setInput("");
      setProcessing(true);
      try {
        const result = await respondToMessage(config, text, () => Promise.resolve(config), { sessionId });
        setMessages((prev) => [...prev, { role: "assistant", content: result.response }]);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
      } finally {
        setProcessing(false);
      }
    },
    [config, processing, sessionId, exit]
  );

  useInput((inputChar, key) => {
    if (key.escape || (key.ctrl && inputChar === "c")) {
      exit();
    }
  });

  const visible = messages.slice(-12);
  const provider = config.llm?.provider ?? "unknown";
  const model = config.llm?.model ?? "unknown";
  const search = config.search?.provider && config.search.provider !== "none" ? config.search.provider : "search off";

  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="single" paddingX={1}>
        <Text bold color="cyan">
          AlphaFoundry Agent TUI
        </Text>
        <Text> | </Text>
        <Text dimColor>
          {provider}/{model} | {search} | {sessionId}
        </Text>
        {processing && (
          <>
            <Text> </Text>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text color="yellow"> thinking...</Text>
          </>
        )}
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1} marginY={1}>
        {visible.map((msg, i) => (
          <Box key={i} flexDirection="column" marginY={1}>
            <Text bold color={msg.role === "user" ? "green" : "blue"}>
              {msg.role === "user" ? "You" : "AlphaFoundry"}:
            </Text>
            <Text>{msg.content}</Text>
          </Box>
        ))}
        {messages.length === 0 && <Text dimColor>Type a message and press Enter...</Text>}
      </Box>

      <Box borderStyle="single" paddingX={1}>
        <Text bold color="green">
          
          {'>'}{' '}
        </Text>
        <TextInput value={input} onChange={setInput} onSubmit={sendMessage} focus={!processing} />
      </Box>

      <Box paddingX={1}>
        <Text dimColor>Enter to send | /help | /clear | /quit | Esc/Ctrl+C to quit</Text>
      </Box>
    </Box>
  );
}

export async function runTui(config: AppConfig): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new Error("TUI requires an interactive terminal.");
  }
  const { render } = await import("ink");
  render(<App config={config} />);
}
