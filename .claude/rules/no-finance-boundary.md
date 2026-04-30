# No Finance Boundary

AlphaFoundry is not ready for finance tool implementation yet.

Do not add:
- finance tools
- trading tools
- market-data connectors
- broker/exchange APIs
- portfolio logic
- alpha models
- strategy templates
- financial advice workflows
- finance-specific MCP servers
- finance-specific config keys, docs, tests, or examples

If the user asks for finance before the generic foundation is ready, stop and explain the boundary. The next work must remain generic runtime/control-plane/policy work unless the user explicitly changes the roadmap.

Finance can only start after a tested opt-in tool-pack/plugin boundary exists and default AlphaFoundry excludes finance tools.
