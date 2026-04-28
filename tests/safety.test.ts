import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateSafety } from "../src/safety.js";

describe("safety", () => {
  it("blocks live trading and order placement", () => {
    const blocked = [
      "place a market order to buy 100 SPY",
      "connect my broker for live trading",
      "submit a trade for SPY",
      "send an order ticket",
      "route this order",
      "connect Alpaca",
      "connect Interactive Brokers",
      "connect IBKR",
      "use my brokerage account",
      "rebalance my portfolio automatically",
      "execute this strategy every morning",
      "auto trade this signal",
      "buy SPY with my account",
      "sell my AAPL shares",
    ];
    for (const message of blocked) assert.equal(evaluateSafety(message).allowed, false, message);
  });

  it("allows normal agent requests", () => {
    assert.equal(evaluateSafety("summarize this project and save a note").allowed, true);
  });
});
