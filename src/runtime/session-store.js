import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync, renameSync, rmSync } from "node:fs";
import { basename, join, normalize } from "node:path";
import { sessionsDir } from "../paths.js";
import { createRuntimeId, parseRuntimeEvent } from "./events.js";
import { redactUnknown } from "../redaction.js";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeTextAtomic(path, text) {
  const tmpPath = `${path}.${createRuntimeId("tmp")}`;
  try {
    writeFileSync(tmpPath, text, { encoding: "utf8", mode: 0o600 });
    renameSync(tmpPath, path);
  } catch (error) {
    rmSync(tmpPath, { force: true });
    throw error;
  }
}

function writeJson(path, value) {
  writeTextAtomic(path, `${JSON.stringify(redactUnknown(value), null, 2)}\n`);
}

function validateSessionId(sessionId) {
  if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId !== basename(sessionId)) {
    throw new Error(`Invalid session id: ${sessionId ?? "<missing>"}`);
  }
  return sessionId;
}

function eventPath(root, sessionId) {
  return join(root, validateSessionId(sessionId), "events.ndjson");
}

function manifestPath(root, sessionId) {
  return join(root, validateSessionId(sessionId), "manifest.json");
}

function artifactPath(root, sessionId, name) {
  if (typeof name !== "string" || name.length === 0 || name !== basename(name)) {
    throw new Error(`Invalid artifact name: ${name ?? "<missing>"}`);
  }
  return join(root, validateSessionId(sessionId), "artifacts", name);
}

function sessionPath(root, sessionId) {
  return join(root, validateSessionId(sessionId));
}

function readEvents(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .flatMap((line) => {
      if (!line.trim()) return [];
      try {
        return [parseRuntimeEvent(line)];
      } catch {
        return [];
      }
    });
}

function writeEventsAtomic(path, events) {
  const text = events.map((event) => JSON.stringify(redactUnknown(event))).join("\n");
  writeTextAtomic(path, text ? `${text}\n` : "");
}

function lockPath(root, sessionId) {
  return join(root, validateSessionId(sessionId), ".lock");
}

function withSessionLock(root, sessionId, fn) {
  const path = lockPath(root, sessionId);
  try {
    mkdirSync(path, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`AlphaFoundry session is locked: ${sessionId}`);
    throw error;
  }
  try {
    return fn();
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
}

export function createSessionStore(options = {}) {
  const root = normalize(options.root ?? sessionsDir(options.env ?? process.env));
  const maxEventsPerSession = Number.isInteger(options.maxEventsPerSession) && options.maxEventsPerSession > 0 ? options.maxEventsPerSession : null;

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

  function compactSessionUnlocked(sessionId, options = {}) {
    ensureRoot();
    const manifest = readManifest(sessionId);
    let events = readEvents(eventPath(root, sessionId));
    const keepLast = Number.isInteger(options.keepLast) && options.keepLast > 0 ? options.keepLast : null;
    if (keepLast !== null && events.length > keepLast) events = events.slice(-keepLast);

    events = events.map((event, index) => ({
      ...event,
      sessionId: event.sessionId ?? sessionId,
      sequence: index + 1,
    }));

    writeEventsAtomic(eventPath(root, sessionId), events);
    manifest.eventCount = events.length;
    manifest.updatedAt = events.at(-1)?.timestamp ?? manifest.updatedAt ?? new Date().toISOString();
    writeManifest(manifest);
    return { manifest, events, compactedEventCount: events.length };
  }

  function compactSession(sessionId, options = {}) {
    return withSessionLock(root, sessionId, () => compactSessionUnlocked(sessionId, options));
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
        artifactCount: 0,
        status: "created",
      };
      writeManifest(manifest);
      writeFileSync(eventPath(root, id), "", { encoding: "utf8", mode: 0o600 });
      return manifest;
    },

    appendEvent(sessionId, event) {
      return withSessionLock(root, sessionId, () => {
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
        if (maxEventsPerSession !== null && manifest.eventCount > maxEventsPerSession) compactSessionUnlocked(sessionId, { keepLast: maxEventsPerSession });
        return next;
      });
    },

    compactSession,

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

    writeArtifact(sessionId, artifact) {
      ensureRoot();
      const manifest = readManifest(sessionId);
      const path = artifactPath(root, sessionId, artifact?.name);
      const content = redactUnknown(artifact.content ?? {});
      writeJson(path, content);
      manifest.artifactCount = (manifest.artifactCount ?? 0) + 1;
      manifest.updatedAt = artifact.updatedAt ?? new Date().toISOString();
      writeManifest(manifest);
      return { name: artifact.name, path, content };
    },

    readArtifact(sessionId, name) {
      readManifest(sessionId);
      const path = artifactPath(root, sessionId, name);
      return { name, path, content: readJson(path) };
    },

    exportSession(sessionId, options = {}) {
      const session = this.readSession(sessionId);
      if (options.format === "ndjson") return session.events.map((event) => JSON.stringify(event)).join("\n") + "\n";
      return redactUnknown(session);
    },
  };
}
