import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createEvidence,
  createVerificationArtifact,
  createVerifierResult,
  summarizeVerifierResults,
  VERIFICATION_SUMMARY_ARTIFACT_NAME,
  VERIFIER_STATUSES,
} from "../src/runtime/evidence.js";
import { createSessionStore } from "../src/runtime/session-store.js";

function tempHome() {
  return mkdtempSync(join(tmpdir(), "af-evidence-"));
}

test("verifier statuses are stable and fail closed", () => {
  assert.deepEqual(VERIFIER_STATUSES, Object.freeze(["PASS", "WARN", "FAIL"]));
  assert.equal(createVerifierResult({ name: "format", status: "pass" }).status, "PASS");
  assert.throws(() => createVerifierResult({ name: "format", status: "SKIP" }), /Unsupported verifier status/);
  assert.throws(() => createEvidence({ kind: "artifact" }), /evidence title must be a non-empty string/);
});

test("evidence and verifier results are schema-versioned redacted data", () => {
  const evidence = createEvidence({
    id: "evd_fixed",
    kind: "artifact",
    title: "Run summary",
    summary: "token=sk-secret1234567890",
    uri: "artifacts/run-summary.json",
    data: { apiKey: "sk-secret1234567890", lineCount: 3 },
    timestamp: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.evidenceId, "evd_fixed");
  assert.equal(evidence.kind, "artifact");
  assert.doesNotMatch(JSON.stringify(evidence), /sk-secret/);
  assert.match(JSON.stringify(evidence), /\[REDACTED_SECRET\]/);

  const result = createVerifierResult({
    id: "ver_fixed",
    name: "summary-check",
    status: "warn",
    summary: "api_key=sk-secret1234567890",
    evidence: [evidence],
    runId: "run_test",
    timestamp: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.verifierId, "ver_fixed");
  assert.equal(result.status, "WARN");
  assert.equal(result.runId, "run_test");
  assert.doesNotMatch(JSON.stringify(result), /sk-secret/);
});

test("verification summaries aggregate PASS WARN and FAIL results", () => {
  const results = [
    createVerifierResult({ name: "one", status: "PASS" }),
    createVerifierResult({ name: "two", status: "WARN" }),
    createVerifierResult({ name: "three", status: "FAIL" }),
  ];

  const summary = summarizeVerifierResults(results, { runId: "run_test", timestamp: "2026-01-01T00:00:00.000Z" });

  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.runId, "run_test");
  assert.equal(summary.status, "FAIL");
  assert.deepEqual(summary.counts, { PASS: 1, WARN: 1, FAIL: 1 });
  assert.equal(summary.results.length, 3);
});

test("verification artifacts bundle summary data and artifact evidence", () => {
  const artifact = createVerificationArtifact([
    { name: "summary-check", status: "WARN", summary: "token=sk-secret1234567890" },
  ], {
    runId: "run_test",
    timestamp: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(VERIFICATION_SUMMARY_ARTIFACT_NAME, "verification-summary.json");
  assert.equal(artifact.name, "verification-summary.json");
  assert.equal(artifact.content.status, "WARN");
  assert.deepEqual(artifact.content.counts, { PASS: 0, WARN: 1, FAIL: 0 });
  assert.equal(artifact.evidence.kind, "artifact");
  assert.equal(artifact.evidence.title, "Verification summary");
  assert.equal(artifact.evidence.uri, "artifacts/verification-summary.json");
  assert.doesNotMatch(JSON.stringify(artifact), /sk-secret/);
});

test("session store persists generic redacted verification artifacts", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "evidence run", adapter: "mock" });
    const summary = summarizeVerifierResults([
      createVerifierResult({
        name: "summary-check",
        status: "PASS",
        summary: "token=sk-secret1234567890",
      }),
    ]);

    const artifact = store.writeArtifact(session.id, { name: "verification-summary.json", content: summary });

    assert.equal(artifact.name, "verification-summary.json");
    assert.equal(artifact.content.status, "PASS");
    assert.doesNotMatch(readFileSync(artifact.path, "utf8"), /sk-secret/);
    assert.deepEqual(store.readArtifact(session.id, "verification-summary.json").content.counts, { PASS: 1, WARN: 0, FAIL: 0 });
    assert.equal(store.readSession(session.id).manifest.artifactCount, 1);
    assert.throws(() => store.writeArtifact(session.id, { name: "../escape.json", content: {} }), /Invalid artifact name/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
