import { byteLength, takeBytes } from "./events.js";

export function createStats(initialModel = {}) {
  return {
    runs: 0,
    completed: 0,
    failed: 0,
    aborted: 0,
    stdoutBytes: 0,
    stderrBytes: 0,
    outputBytes: 0,
    cappedBytes: 0,
    lastExitCode: null,
    running: false,
    ...(initialModel.provider || initialModel.model
      ? { model: { provider: initialModel.provider, model: initialModel.model } }
      : {}),
  };
}

export function cloneStats(stats) {
  return {
    runs: stats.runs,
    completed: stats.completed,
    failed: stats.failed,
    aborted: stats.aborted,
    stdoutBytes: stats.stdoutBytes,
    stderrBytes: stats.stderrBytes,
    outputBytes: stats.outputBytes,
    cappedBytes: stats.cappedBytes,
    lastExitCode: stats.lastExitCode,
    running: stats.running,
    ...(stats.model ? { model: { ...stats.model } } : {}),
  };
}

export function createOutputAccumulator(maxOutputBytes) {
  const limit = Number.isFinite(maxOutputBytes) ? Math.max(0, maxOutputBytes) : 1024 * 1024;
  let retainedBytes = 0;
  let cappedBytes = 0;
  let stdout = "";
  let stderr = "";

  function append(stream, chunk) {
    const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk ?? "");
    const totalBytes = byteLength(text);
    const remaining = Math.max(0, limit - retainedBytes);
    const kept = takeBytes(text, remaining);
    const keptBytes = byteLength(kept);
    retainedBytes += keptBytes;
    cappedBytes += totalBytes - keptBytes;

    if (stream === "stdout") stdout += kept;
    if (stream === "stderr") stderr += kept;

    return {
      text,
      kept,
      totalBytes,
      keptBytes,
      cappedBytes: totalBytes - keptBytes,
      capped: totalBytes !== keptBytes,
    };
  }

  return {
    append,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
    get retainedBytes() {
      return retainedBytes;
    },
    get cappedBytes() {
      return cappedBytes;
    },
    get capped() {
      return cappedBytes > 0;
    },
  };
}
