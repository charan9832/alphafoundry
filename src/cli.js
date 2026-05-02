#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfiguredPiArgs, resolvePiProcessEnv } from "./pi-backend.js";
import { defaultConfigPath, getConfigValue, initConfig, repairConfig, resolveRuntimeConfig, setConfigValue } from "./config.js";
import { formatDoctor, runDoctor } from "./doctor.js";
import { resolveTsxLoaderUrl } from "./dependencies.js";
import { redactConfigValue } from "./redaction.js";
import { createSessionStore } from "./runtime/session-store.js";
import { createApprovalStore } from "./runtime/approval-store.js";
import { replaySession } from "./runtime/replay.js";
import { evaluateSession } from "./runtime/evals.js";
import { runPrompt } from "./runtime/runner.js";
import { summarizeToolPackStatus } from "./runtime/tool-packs.js";

function packageRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

function runInkTui() {
  const root = packageRoot();
  const runFile = join(root, "src", "tui", "run-cli.jsx");
  const result = spawnSync(process.execPath, ["--import", resolveTsxLoaderUrl(), runFile], {
    stdio: "inherit",
    env: { ...process.env },
  });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 0;
}

function printHelp() {
  console.log(`AlphaFoundry - native AI product workspace with Pi Agent runtime adapter

Usage:
  af                         Start AlphaFoundry Ink TUI
  af tui                     Start AlphaFoundry Ink TUI
  af init [--non-interactive] Create ~/.alphafoundry/config.json
  af doctor [--json]         Check local AlphaFoundry health
  af config path             Print active config path
  af config get <key>        Read config key (provider, model, env.apiKey, env.baseUrl)
  af config set <key> <value> Set provider/model/env var names only; never raw secrets
  af config repair           Remove unsupported legacy config keys and preserve safe values
  af models                  Explain backend-delegated model listing
  af tool-packs [--json]     Show optional tool-pack registry and enablement boundary
  af session                 Explain AlphaFoundry session support
  af sessions list [--json]  List durable AlphaFoundry sessions
  af sessions show <id> [--json] Show a durable session transcript
  af sessions export <id> [--json|--ndjson] Export a session transcript
  af sessions replay <id> [--json] Replay a session into a deterministic summary
  af sessions eval <id> [--json] Evaluate a session with local PASS/WARN/FAIL checks
  af approvals list [--json] List persisted approval decisions
  af approvals show <id> [--json] Show one approval decision
  af approvals export [--json|--ndjson] Export approval decisions
  af approvals expire <id> [--json] Expire one approval decision
  af -p "message" [--json|--stream-json] [--tools code-edit|read-only|shell|none] Run one prompt with AlphaFoundry-owned session/events
  af --provider openai --model gpt-4o-mini -p "message"

AlphaFoundry owns the product identity and command surface. Pi Agent is the runtime adapter for model/tool execution.
`);
}

function handleInit(args) {
  const nonInteractive = args.includes("--non-interactive");
  if (!nonInteractive && !process.stdin.isTTY) {
    console.error("Use af init --non-interactive when running without a TTY.");
    return 1;
  }
  const result = initConfig({ nonInteractive });
  console.log(`AlphaFoundry config ${result.created ? "created" : "already exists"}: ${result.path}`);
  return 0;
}

function handleConfig(args) {
  const subcommand = args[0];
  if (subcommand === "path") {
    console.log(defaultConfigPath());
    return 0;
  }
  if (subcommand === "get") {
    const key = args[1];
    if (!key) {
      console.error("Usage: af config get <key>");
      return 1;
    }
    const value = redactConfigValue(key, getConfigValue(key));
    if (typeof value === "object") console.log(JSON.stringify(value, null, 2));
    else if (value !== undefined) console.log(String(value));
    return value === undefined ? 1 : 0;
  }
  if (subcommand === "set") {
    const [key, value] = args.slice(1);
    if (!key || !value) {
      console.error("Usage: af config set <key> <value>");
      return 1;
    }
    const result = setConfigValue(key, value);
    console.log(`AlphaFoundry config updated: ${key} (${result.path})`);
    return 0;
  }
  if (subcommand === "repair") {
    const result = repairConfig();
    if (result.created) {
      console.log(`AlphaFoundry config created: ${result.path}`);
    } else if (result.removed.length > 0) {
      console.log(`AlphaFoundry config repaired: removed unsupported keys: ${result.removed.join(", ")} (${result.path})`);
    } else {
      console.log(`AlphaFoundry config already valid: ${result.path}`);
    }
    return 0;
  }
  console.error("Usage: af config path|get|set|repair");
  return 1;
}

function handleDoctor(args) {
  const report = runDoctor();
  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatDoctor(report));
  }
  return report.status === "fail" ? 1 : 0;
}

function handleModels() {
  console.log(`AlphaFoundry models

Model discovery is delegated to the configured runtime adapter. The current adapter is @mariozechner/pi-coding-agent, so provider/model flags continue to pass through to that backend.

Use:
  af config set provider <name>
  af config set model <model>
  af --provider <name> --model <model> -p "hello"
`);
  return 0;
}

function handleToolPacks(args) {
  const status = summarizeToolPackStatus();
  if (args.includes("--json")) {
    printJson(status);
  } else {
    console.log(`AlphaFoundry tool packs

Default optional packs: none enabled
Registered optional packs: ${status.registry.registeredCount}
Current enabled packs: ${status.enablement.enabled.length === 0 ? "none" : status.enablement.enabled.join(", ")}

Boundary:
- optional packs are disabled by default
- domain packs are gated until an explicit opt-in policy exists
- executable packs, MCP loading, and native tool execution are not available in this milestone

Next gate: ${status.nextGate}
`);
  }
  return 0;
}

function handleSession() {
  console.log(`AlphaFoundry sessions

Session-aware workflows are part of the AlphaFoundry product surface. Durable session listing/export plus local replay/eval summaries are available through:

  af sessions list
  af sessions show <id>
  af sessions export <id>
  af sessions replay <id>
  af sessions eval <id>
`);
  return 0;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function parseFlagValue(args, names) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    for (const name of names) {
      if (arg === name) return args[i + 1];
      if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
    }
  }
  return undefined;
}

function removeOptionPairs(args, names) {
  const output = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (names.includes(arg)) {
      i += 1;
      continue;
    }
    if (names.some((name) => arg.startsWith(`${name}=`))) continue;
    output.push(arg);
  }
  return output;
}

function formatCheckLine(check) {
  const details = Object.entries(check)
    .filter(([key]) => !["name", "status"].includes(key))
    .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" ");
  return `${check.status}\t${check.name}${details ? `\t${details}` : ""}`;
}

function handleSessions(args) {
  const [subcommand, maybeId] = args;
  const store = createSessionStore();
  const json = args.includes("--json");
  const ndjson = args.includes("--ndjson");

  try {
    if (subcommand === "list") {
      const sessions = store.listSessions();
      if (json) printJson({ sessions });
      else if (sessions.length === 0) console.log("No AlphaFoundry sessions found.");
      else for (const session of sessions) console.log(`${session.id}\t${session.status}\t${session.updatedAt}\t${session.cwd}`);
      return 0;
    }
    if (subcommand === "show") {
      if (!maybeId) {
        console.error("Usage: af sessions show <id> [--json]");
        return 1;
      }
      const session = store.readSession(maybeId);
      if (json) printJson(session);
      else {
        console.log(`Session ${session.manifest.id}`);
        console.log(`Status: ${session.manifest.status}`);
        console.log(`CWD: ${session.manifest.cwd}`);
        console.log(`Events: ${session.events.length}`);
        for (const event of session.events) console.log(`${event.sequence ?? "?"}\t${event.type}\t${event.timestamp}`);
      }
      return 0;
    }
    if (subcommand === "export") {
      if (!maybeId) {
        console.error("Usage: af sessions export <id> [--json|--ndjson]");
        return 1;
      }
      const exported = store.exportSession(maybeId, { format: ndjson ? "ndjson" : "json" });
      if (typeof exported === "string") process.stdout.write(exported);
      else printJson(exported);
      return 0;
    }
    if (subcommand === "replay") {
      if (!maybeId) {
        console.error("Usage: af sessions replay <id> [--json]");
        return 1;
      }
      const summary = replaySession(store, maybeId);
      if (json) printJson(summary);
      else {
        console.log(`Replay ${summary.sessionId}`);
        console.log(`Status: ${summary.status}`);
        console.log(`Events: ${summary.eventTotal}`);
        console.log(`Assistant text: ${summary.assistant.textLength} chars (${summary.assistant.textDigest})`);
        console.log(`Tools: ${summary.toolCallCount} calls, ${summary.toolResultCount} results`);
        console.log(`Errors: ${summary.errorCount}`);
        console.log(`Duration: ${summary.durationMs ?? "unknown"} ms`);
      }
      return 0;
    }
    if (subcommand === "eval") {
      if (!maybeId) {
        console.error("Usage: af sessions eval <id> [--json]");
        return 1;
      }
      const result = evaluateSession(store, maybeId);
      if (json) printJson(result);
      else {
        console.log(`Eval ${result.sessionId}: ${result.overall}`);
        for (const check of result.checks) console.log(formatCheckLine(check));
      }
      return 0;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  console.error("Usage: af sessions list|show|export|replay|eval");
  return 1;
}

function handleApprovals(args) {
  const [subcommand, maybeId] = args;
  const store = createApprovalStore();
  const json = args.includes("--json");
  const ndjson = args.includes("--ndjson");

  try {
    if (subcommand === "list") {
      const decisions = store.list();
      if (json) printJson({ decisions });
      else if (decisions.length === 0) console.log("No AlphaFoundry approval decisions found. Approvals are recorded when a future interactive tool flow asks for allow/deny decisions.");
      else for (const decision of decisions) console.log(`${decision.decisionId}\t${decision.status}\t${decision.createdAt}\t${decision.toolName ?? "unknown"}\t${decision.reason ?? ""}`);
      return 0;
    }
    if (subcommand === "show") {
      if (!maybeId) {
        console.error("Usage: af approvals show <id> [--json]");
        return 1;
      }
      const decision = store.read(maybeId);
      if (json) printJson(decision);
      else {
        console.log(`Approval ${decision.decisionId}`);
        console.log(`Status: ${decision.status}`);
        console.log(`Tool: ${decision.toolName ?? "unknown"}`);
        console.log(`Risk: ${decision.risk ?? "unknown"}`);
        console.log(`Session: ${decision.sessionId ?? "none"}`);
        console.log(`Run: ${decision.runId ?? "none"}`);
        console.log(`Reason: ${decision.reason ?? ""}`);
        console.log(`Created: ${decision.createdAt}`);
        if (decision.expired) console.log(`Expired: ${decision.expiredAt ?? "yes"}`);
      }
      return 0;
    }
    if (subcommand === "export") {
      const exported = store.export({ format: ndjson ? "ndjson" : "json" });
      if (typeof exported === "string") process.stdout.write(exported);
      else printJson(exported);
      return 0;
    }
    if (subcommand === "expire") {
      if (!maybeId) {
        console.error("Usage: af approvals expire <id> [--json]");
        return 1;
      }
      const expired = store.expire(maybeId);
      if (json) printJson(expired);
      else console.log(`Approval ${expired.decisionId} expired.`);
      return 0;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${message}\nRecovery: run 'af approvals list' to inspect known approval decision ids.`);
    return 1;
  }

  console.error("Usage: af approvals list|show|export|expire");
  return 1;
}

async function handleRun(args) {
  const json = args.includes("--json");
  const streamJson = args.includes("--stream-json");
  const prompt = parseFlagValue(args, ["-p", "--prompt"]);
  if (!prompt) {
    console.error("Usage: af -p <message> [--json|--stream-json] [--tools <profile>|--allow-tools <list>] [--permission-mode <mode>]");
    return 1;
  }
  const providerOverride = parseFlagValue(args, ["--provider"]);
  const modelOverride = parseFlagValue(args, ["--model"]);
  const toolProfile = parseFlagValue(args, ["--tools", "--tool-profile"]);
  const toolAllow = parseFlagValue(args, ["--allow-tools"]);
  const permissionMode = parseFlagValue(args, ["--permission-mode", "--mode"]);

  try {
    const runtimeConfig = resolveRuntimeConfig({ provider: providerOverride, model: modelOverride });

    const runOptions = {
      prompt,
      provider: runtimeConfig.provider,
      model: runtimeConfig.model,
      runtimeEnv: runtimeConfig.env,
      cwd: process.cwd(),
      env: process.env,
      toolProfile,
      toolAllow,
      permissionMode,
    };

    if (streamJson) {
      runOptions.onEvent = (event) => {
        process.stdout.write(`${JSON.stringify(event)}\n`);
      };
    }

    const result = await runPrompt(runOptions);

    if (streamJson) {
      // Events already streamed in real-time; no extra footer needed
    } else if (json) {
      printJson(result);
    } else {
      const text = result.events?.find((event) => event.type === "assistant")?.payload?.text ?? "";
      if (text) process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
    }
    return result.result?.ok === false ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    const pkg = JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8"));
    console.log(pkg.version);
    return 0;
  }

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return 0;
  }

  const [command, ...rest] = args;
  if (command === "init") return handleInit(rest);
  if (command === "doctor") return handleDoctor(rest);
  if (command === "config") return handleConfig(rest);
  if (command === "models") return handleModels(rest);
  if (command === "tool-packs") return handleToolPacks(rest);
  if (command === "session") return handleSession(rest);
  if (command === "sessions") return handleSessions(rest);
  if (command === "approvals") return handleApprovals(rest);
  if (command === "run") {
    console.error("Unknown AlphaFoundry command: run. Use af -p <message> for one-shot prompts or af to open the app.");
    return 1;
  }
  if (parseFlagValue(args, ["-p", "--prompt"])) return handleRun(args);

  if (args.length === 0 || args[0] === "tui") {
    return runInkTui();
  }

  const runtimeConfig = resolveRuntimeConfig();
  const result = spawnSync(process.execPath, buildConfiguredPiArgs(args, runtimeConfig), {
    stdio: "inherit",
    env: resolvePiProcessEnv(runtimeConfig),
  });

  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
