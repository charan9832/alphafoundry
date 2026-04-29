import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join, normalize } from "node:path";
import { sessionsDir } from "../paths.js";
import { createRuntimeId, parseRuntimeEvent } from "./events.js";
import { redactUnknown } from "../redaction.js";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(redactUnknown(value), null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function eventPath(root, sessionId) {
  return join(root, sessionId, "events.ndjson");
}

function manifestPath(root, sessionId) {
  return join(root, sessionId, "manifest.json");
}

function sessionPath(root, sessionId) {
  return join(root, sessionId);
}

function readEvents(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => parseRuntimeEvent(line));
}

export function createSessionStore(options = {}) {
  const root = normalize(options.root ?? sessionsDir(options.env ?? process.env));

  function ensureRoot() {
    mkdirSync(root, { recursive: true, mode: 0o700 });
  }

  function readManifest(sessionId) {
    const path = manifestPath(root, sessionId);
    if (!existsSync(path)) throw new Error(`Unknown AlphaFoundry session: ${sessionId}`);
    return readJson(path);
  }

  function writeManifest(manifest) {
    writeJson(manifestPath(root, manifest.id), manifest);
  }

  return {
    root,

    createSession(input = {}) {
      ensureRoot();
      const id = input.id ?? createRuntimeId("ses");
      const dir = sessionPath(root, id);
      mkdirSync(join(dir, "artifacts"), { recursive: true, mode: 0o700 });
      const now = input.createdAt ?? new Date().toISOString();
      const manifest = {
        schemaVersion: 1,
        id,
        title: input.title ?? "AlphaFoundry run",
        cwd: normalize(input.cwd ?? process.cwd()),
        adapter: input.adapter ?? "pi",
        createdAt: now,
        updatedAt: now,
        eventCount: 0,
        status: "created",
      };
      writeManifest(manifest);
      writeFileSync(eventPath(root, id), "", { encoding: "utf8", mode: 0o600 });
      return manifest;
    },

    appendEvent(sessionId, event) {
      ensureRoot();
      const manifest = readManifest(sessionId);
      const sequence = manifest.eventCount + 1;
      const next = redactUnknown({ ...event, sessionId: event.sessionId ?? sessionId, sequence });
      appendFileSync(eventPath(root, sessionId), `${JSON.stringify(next)}\n`, { encoding: "utf8", mode: 0o600 });
      manifest.eventCount = sequence;
      manifest.updatedAt = next.timestamp ?? new Date().toISOString();
      if (event.type === "run_end") manifest.status = event.payload?.ok ? "success" : "error";
      else if (event.type === "run_start") manifest.status = "running";
      writeManifest(manifest);
      return next;
    },

    listSessions() {
      ensureRoot();
      return readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          try {
            return readManifest(entry.name);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    },

    readSession(sessionId) {
      const manifest = readManifest(sessionId);
      return { manifest, events: readEvents(eventPath(root, sessionId)) };
    },

    exportSession(sessionId, options = {}) {
      const session = this.readSession(sessionId);
      if (options.format === "ndjson") return session.events.map((event) => JSON.stringify(event)).join("\n") + "\n";
      return redactUnknown(session);
    },
  };
}
