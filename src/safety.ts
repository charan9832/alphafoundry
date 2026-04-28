export interface SafetyDecision {
  allowed: boolean;
  reason?: string;
}

const LIVE_TRADING_PATTERNS = [
  /\blive\s+trad(e|ing)\b/i,
  /\bplace\s+(an?\s+)?order\b/i,
  /\bsubmit\s+(an?\s+)?(trade|order)\b/i,
  /\bsend\s+(an?\s+)?order\s+ticket\b/i,
  /\broute\s+.*order\b/i,
  /\bbuy\s+\d+/i,
  /\bsell\s+\d+/i,
  /\bbuy\s+[A-Z]{1,5}\s+with\s+my\s+account\b/i,
  /\bsell\s+my\s+[A-Z]{1,5}/i,
  /\bbroker(age)?\b/i,
  /\bconnect\s+.*account\b/i,
  /\b(use|sync|access)\s+my\s+.*account\b/i,
  /\bconnect\s+(alpaca|interactive\s+brokers|ibkr|coinbase|binance)\b/i,
  /\bexecute\s+.*(trade|strategy)\b/i,
  /\bauto\s*trade\b/i,
  /\brebalance\s+my\s+portfolio\s+automatically\b/i,
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
