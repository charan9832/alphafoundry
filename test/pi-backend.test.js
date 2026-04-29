import test from "node:test";
import assert from "node:assert/strict";
import { runPi } from "../src/pi-backend.js";

test("legacy Pi backend caps retained output", async () => {
  const result = await runPi(["--version"], { maxOutputBytes: 2 });
  assert.equal(result.ok, true);
  assert.ok(result.output.length <= 2);
  assert.ok(result.cappedBytes > 0);
});
