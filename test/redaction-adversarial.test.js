import test from "node:test";
import assert from "node:assert/strict";
import { redactText, redactUnknown } from "../src/redaction.js";
import { createRuntimeEvent } from "../src/runtime/events.js";
import { createSessionStore } from "../src/runtime/session-store.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function tempHome() {
  return mkdtempSync(join(tmpdir(), "af-redaction-"));
}

const openAiKey = "sk" + "-live_secret_12345";
const githubToken = "gh" + "p_abcdefghijklmnopqrstuvwxyz123456";
const githubPat = "github" + "_pat_11ABCDEFG_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const npmToken = "npm" + "_abcdefghijklmnopqrstuvwxyz1234567890";
const slackToken = "xox" + "b-1234567890-abcdefghijklmno";
const googleKey = "AI" + "zaSyDjuCiJ7mgOwxQqNVthVYJlcrkERSkbkxw";
const bearerToken = "abc" + ".def.ghi";
const urlUser = "user" + "123";
const urlPassword = "pass" + "456";

const adversarialText = [
  `OPENAI_API_KEY=${openAiKey}`,
  `GITHUB_TOKEN=${githubToken}`,
  githubPat,
  `NPM_TOKEN=${npmToken}`,
  `SLACK=${slackToken}`,
  `GOOGLE=${googleKey}`,
  `Authorization: Bearer ${bearerToken}`,
  `proxy=https://${urlUser}:${urlPassword}@example.com/path`,
].join("\n");

const forbiddenParts = [openAiKey, githubToken, "github_pat_", npmToken, slackToken, "AIzaSyDju", bearerToken, `${urlUser}:${urlPassword}`];

function assertNoForbiddenSecrets(text) {
  for (const forbidden of forbiddenParts) assert.doesNotMatch(text, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

test("redactText covers common adversarial token and URL credential patterns", () => {
  const redacted = redactText(adversarialText);
  assertNoForbiddenSecrets(redacted);
  assert.match(redacted, /\[REDACTED_SECRET\]/);
  assert.match(redacted, /https:\/\/\[REDACTED_SECRET\]:\[REDACTED_SECRET\]@example\.com/);
});

test("redactUnknown redacts nested adversarial secrets without mutating safe fields", () => {
  const redacted = redactUnknown({
    safe: "hello",
    nested: { output: adversarialText },
    list: [`token=${"gh" + "o_abcdefghijklmnopqrstuvwxyz123456"}`],
  });
  const json = JSON.stringify(redacted);
  assert.equal(redacted.safe, "hello");
  assertNoForbiddenSecrets(json);
  assert.match(json, /\[REDACTED_SECRET\]/);
});

test("session persistence and export redact adversarial runtime output", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "adversarial redaction", adapter: "mock" });
    store.appendEvent(session.id, createRuntimeEvent("assistant", {
      sessionId: session.id,
      runId: "run_redact",
      payload: { text: adversarialText, metadata: { authorization: `Bearer ${bearerToken}` } },
    }));
    const read = store.readSession(session.id);
    const exported = store.exportSession(session.id, { format: "json" });
    const ndjson = store.exportSession(session.id, { format: "ndjson" });
    assertNoForbiddenSecrets(JSON.stringify(read));
    assertNoForbiddenSecrets(JSON.stringify(exported));
    assertNoForbiddenSecrets(ndjson);
    assert.match(JSON.stringify(exported), /\[REDACTED_SECRET\]/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
