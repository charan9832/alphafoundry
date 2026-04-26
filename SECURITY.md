# Security Policy

AlphaFoundry is research/paper-trading software. It is not financial advice and does not guarantee profitable strategies.

## Secrets

Never commit:

- GitHub tokens
- broker API keys
- OpenAI/OpenRouter/Azure keys
- exchange credentials
- private datasets

Use environment variables or local untracked config files.

## Trading safety

- Paper mode is the default.
- Live trading is not implemented in the MVP.
- Any future live execution must include explicit human approval, independent risk guards, and a kill switch.

## Reporting issues

Open an issue with a minimal reproduction and avoid including secrets or private trading data.
