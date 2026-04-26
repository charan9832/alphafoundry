# AlphaFoundry Architecture

AlphaFoundry is organized as a CLI-first strategy workbench.

- CLI: Typer/Rich product interface
- Agent: natural-language planning and strategy generation
- Data: CSV first, OpenBB optional
- Backtest: deterministic engine with costs/slippage
- Validate: train/test, stress, robust score
- Optimize: parameter search scaffold
- Autoresearch: bounded Modify -> Verify -> Keep/Discard loop
- Memory: SimpleMem adapter with local fallback
- Wiki: LLM Wiki scaffold for research/global brain
- Models: Kronos/TimesFM/MOMENT/Time-MoE planned as pluggable forecasters

Live trading is out of scope for MVP.
