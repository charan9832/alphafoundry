import { createRuntimeEvent, createRuntimeId } from "../events.js";

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file. Provide the file path.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute or relative path to the file" },
          offset: { type: "integer", description: "Line number to start reading from (1-based, optional)" },
          limit: { type: "integer", description: "Maximum number of lines to read (optional)" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file. Overwrites if it exists.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute or relative path to the file" },
          content: { type: "string", description: "Full content to write" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Apply a targeted edit to a file using fuzzy find/replace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          old_string: { type: "string", description: "Exact text to find (or enough context to be unique)" },
          new_string: { type: "string", description: "Replacement text" },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash",
      description: "Run a shell command in the working directory.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          timeout: { type: "integer", description: "Max seconds to wait (default 120)" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "glob",
      description: "Find files matching a glob pattern. Returns file paths.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern like '*.js' or 'src/**/*.ts'" },
          path: { type: "string", description: "Directory to search in (default cwd)" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep",
      description: "Search file contents with regex. Returns matching lines with line numbers.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex pattern to search for" },
          path: { type: "string", description: "Directory or file to search in (default cwd)" },
          file_glob: { type: "string", description: "Optional glob to filter files" },
        },
        required: ["pattern"],
      },
    },
  },
];

function buildSystemPrompt(cwd) {
  return `You are AlphaFoundry's autonomous coding agent. You work in a terminal environment.
Current working directory: ${cwd}
You have access to tools: read_file, write_file, edit_file, bash, glob, grep.
When editing files, prefer edit_file for small changes and write_file for new files or complete rewrites.
Always verify your work by reading files back after editing.
When running tests, use bash.
Be concise but thorough.`;
}

function resolveApiConfig(options = {}) {
  const apiKey = options.apiKey ?? process.env.ALPHAFOUNDRY_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  const baseUrl = options.baseUrl ?? process.env.ALPHAFOUNDRY_BASE_URL ?? "https://api.openai.com/v1";
  const provider = options.provider ?? "openai";
  const model = options.model ?? "gpt-4o";
  return { apiKey, baseUrl, provider, model };
}

async function* streamChatCompletion({ messages, apiKey, baseUrl, model, tools, signal }) {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model,
    messages,
    stream: true,
    ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        yield parsed;
      } catch {
        // ignore malformed lines
      }
    }
  }
}

async function executeToolCall({ name, arguments: argsJson }, { cwd, maxOutputBytes = 50 * 1024 }) {
  let args;
  try {
    args = JSON.parse(argsJson ?? "{}");
  } catch {
    return { ok: false, output: "", error: `Invalid JSON arguments for ${name}` };
  }

  try {
    const result = await runToolLocally(name, args, { cwd, maxOutputBytes });
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, output: "", error: error?.message ?? String(error) };
  }
}

async function runToolLocally(name, args, { cwd, maxOutputBytes }) {
  const { execFile } = await import("node:child_process");
  const { readFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");

  switch (name) {
    case "read_file": {
      const p = resolve(cwd, args.path);
      if (!existsSync(p)) return { output: "", error: `File not found: ${args.path}` };
      const content = readFileSync(p, "utf8");
      const lines = content.split("\n");
      const offset = Math.max(0, (args.offset ?? 1) - 1);
      const limit = args.limit ?? lines.length;
      const slice = lines.slice(offset, offset + limit);
      return { output: slice.join("\n"), error: "" };
    }
    case "write_file": {
      const { writeFileSync, mkdirSync, dirname } = await import("node:fs");
      const p = resolve(cwd, args.path);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, args.content, "utf8");
      return { output: `Wrote ${p}`, error: "" };
    }
    case "edit_file": {
      const { readFileSync: rfs, writeFileSync: wfs } = await import("node:fs");
      const p = resolve(cwd, args.path);
      const content = rfs(p, "utf8");
      const idx = content.indexOf(args.old_string);
      if (idx === -1) return { output: "", error: `Could not find old_string in ${args.path}` };
      const next = content.slice(0, idx) + args.new_string + content.slice(idx + args.old_string.length);
      wfs(p, next, "utf8");
      return { output: `Edited ${args.path}`, error: "" };
    }
    case "bash": {
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);
      const { stdout, stderr } = await execFileAsync("bash", ["-c", args.command], {
        cwd,
        timeout: (args.timeout ?? 120) * 1000,
        maxBuffer: maxOutputBytes,
      });
      return { output: stdout + (stderr ? `\nstderr:\n${stderr}` : ""), error: "" };
    }
    case "glob": {
      const { glob } = await import("glob");
      const pattern = args.pattern;
      const root = args.path ? resolve(cwd, args.path) : cwd;
      const matches = await glob(pattern, { cwd: root, absolute: false });
      return { output: matches.join("\n"), error: "" };
    }
    case "grep": {
      const { execFileAsync: grepExec } = await import("node:child_process");
      const { promisify: grepPromisify } = await import("node:util");
      const execAsync = grepPromisify(grepExec?.execFile ?? execFile);
      const pattern = args.pattern;
      const target = args.path ? resolve(cwd, args.path) : cwd;
      const globFlag = args.file_glob ? `--include=${args.file_glob}` : "";
      const cmd = `grep -rn ${globFlag} -E "${pattern.replace(/"/g, '\\"')}" "${target}" || true`;
      const { stdout } = await execAsync("bash", ["-c", cmd], { cwd, maxBuffer: maxOutputBytes });
      return { output: stdout, error: "" };
    }
    default:
      return { output: "", error: `Unknown tool: ${name}` };
  }
}

export async function runLivePrompt(options = {}) {
  const prompt = options.prompt;
  if (typeof prompt !== "string" || prompt.length === 0) {
    throw new TypeError("runLivePrompt: prompt must be a non-empty string");
  }

  const { apiKey, baseUrl, provider, model } = resolveApiConfig(options);
  const cwd = options.cwd ?? process.cwd();
  const store = options.store;
  const sessionId = options.sessionId;
  const runId = options.runId ?? createRuntimeId("run");
  const onEvent = options.onEvent;
  const approval = options.approval ?? { mode: "auto" };
  const maxTurns = options.maxTurns ?? 30;
  const tools = options.toolsEnabled !== false ? TOOL_DEFINITIONS : [];

  const events = [];
  function emit(type, payload) {
    const event = createRuntimeEvent(type, { sessionId, runId, payload, timestamp: new Date().toISOString() });
    events.push(event);
    if (store?.appendEvent) store.appendEvent(sessionId, event);
    if (onEvent) onEvent(event);
    return event;
  }

  emit("run_start", { adapter: "live-openai", provider, model, prompt });
  emit("user", { text: prompt });

  const messages = [
    { role: "system", content: buildSystemPrompt(cwd) },
    { role: "user", content: prompt },
  ];

  let turnCount = 0;
  let finalText = "";
  let finalError = "";
  const controller = new AbortController();
  const signal = controller.signal;

  try {
    while (turnCount < maxTurns) {
      turnCount++;
      let assistantContent = "";
      const toolCalls = [];
      let inToolCall = false;

      const stream = streamChatCompletion({ messages, apiKey, baseUrl, model, tools, signal });

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          assistantContent += delta.content;
          emit("assistant_delta", { text: delta.content });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index ?? 0;
            if (!toolCalls[index]) {
              toolCalls[index] = { id: tc.id ?? `call_${index}`, name: "", arguments: "" };
            }
            if (tc.function?.name) toolCalls[index].name += tc.function.name;
            if (tc.function?.arguments) toolCalls[index].arguments += tc.function.arguments;
          }
        }

        if (chunk.choices?.[0]?.finish_reason) {
          break;
        }
      }

      if (assistantContent) {
        messages.push({ role: "assistant", content: assistantContent });
        finalText += assistantContent;
        emit("assistant", { text: assistantContent });
      }

      if (toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        const toolResults = [];
        for (const tc of toolCalls) {
          emit("tool_call", { name: tc.name, arguments: tc.arguments });

          let approved = approval.mode === "auto";
          if (approval.mode === "ask") {
            if (approval.ask) {
              approved = await approval.ask({ name: tc.name, arguments: tc.arguments });
            }
          }

          if (!approved) {
            emit("permission_decision", { tool: tc.name, approved: false });
            emit("tool_result", { name: tc.name, output: "", error: "User denied tool execution" });
            toolResults.push({
              role: "tool",
              tool_call_id: tc.id,
              content: "User denied tool execution",
            });
            continue;
          }

          emit("permission_decision", { tool: tc.name, approved: true });
          const result = await executeToolCall({ name: tc.name, arguments: tc.arguments }, { cwd, maxOutputBytes: options.maxOutputBytes });
          emit("tool_result", { name: tc.name, output: result.output, error: result.error });
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result.error ? `Error: ${result.error}` : result.output,
          });
        }

        messages.push(...toolResults);
        continue;
      }

      break;
    }
  } catch (error) {
    finalError = error?.message ?? String(error);
    emit("error", { text: finalError, error: finalError });
  }

  emit("run_end", {
    ok: !finalError,
    exitCode: finalError ? 1 : 0,
    cappedBytes: 0,
    adapter: "live-openai",
  });

  return {
    ok: !finalError,
    status: finalError ? 1 : 0,
    output: finalText,
    error: finalError,
    events,
    messages,
  };
}
