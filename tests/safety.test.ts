import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateSafety } from "../src/safety.js";

describe("safety", () => {
  it("blocks live trading and order placement", () => {
    assert.equal(evaluateSafety("place a market order to buy 100 SPY").allowed, false);
    assert.equal(evaluateSafety("connect my broker for live trading").allowed, false);
  });

  it("allows research requests", () => {
    assert.equal(evaluateSafety("backtest a SPY strategy with slippage").allowed, true);
  });
});
