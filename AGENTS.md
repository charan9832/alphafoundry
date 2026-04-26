# AlphaFoundry Agent Guide

AlphaFoundry agents must follow these rules:

1. Paper trading first. Do not implement live trading without explicit human approval.
2. Use mechanical verification. Never trust LLM-generated performance numbers.
3. One strategy change per autoresearch iteration.
4. Keep/revert based on robust validation metrics.
5. Store durable lessons in memory/wiki, not transient logs.
6. Treat generated strategy code as untrusted until tests and validators pass.
