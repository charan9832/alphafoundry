import { describe, expect, it } from "vitest";
import { evaluateSafety } from "../src/safety.js";

describe("safety", () => {
  it("blocks live trading and order placement", () => {
    expect(evaluateSafety("place a market order to buy 100 SPY").allowed).toBe(false);
    expect(evaluateSafety("connect my broker for live trading").allowed).toBe(false);
  });

  it("allows research requests", () => {
    expect(evaluateSafety("backtest a SPY strategy with slippage").allowed).toBe(true);
  });
});
