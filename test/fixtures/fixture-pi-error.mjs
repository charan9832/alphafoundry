const args = process.argv.slice(2);
const promptIndex = args.findIndex((arg) => arg === "-p" || arg === "--prompt");
const hasPrompt = promptIndex !== -1 && typeof args[promptIndex + 1] === "string";

if (hasPrompt) {
  console.log(JSON.stringify({ type: "agent_start" }));
  console.log(JSON.stringify({
    type: "message_end",
    message: {
      role: "assistant",
      content: [],
      stopReason: "error",
      errorMessage: "fixture provider error",
    },
  }));
  console.log(JSON.stringify({
    type: "agent_end",
    messages: [{ role: "assistant", content: [], errorMessage: "fixture provider error" }],
  }));
  process.exit(0);
}

console.log("fixture-pi 0.0.0");
