export interface SafetyDecision {
  allowed: boolean;
  reason?: string;
}

const LIVE_TRADING_PATTERNS = [
  /\blive\s+trad(e|ing)\b/i,
  /\bplace\s+(an?\s+)?order\b/i,
  /\bbuy\s+\d+/i,
  /\bsell\s+\d+/i,
  /\bbroker\b/i,
  /\bconnect\s+.*account\b/i,
  /\bexecute\s+.*trade\b/i,
  /\bmarket\s+order\b/i,
  /\blimit\s+order\b/i,
];

export function evaluateSafety(message: string): SafetyDecision {
  for (const pattern of LIVE_TRADING_PATTERNS) {
    if (pattern.test(message)) {
      return {
        allowed: false,
        reason:
          "AlphaFoundry is research/paper-validation only. Live trading, broker access, and order placement are disabled.",
      };
    }
  }
  return { allowed: true };
}

export function researchDisclaimer(): string {
  return "Research and paper validation only. No live trading, broker access, order placement, or profit guarantees.";
}
