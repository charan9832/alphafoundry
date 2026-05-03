// AlphaFoundry design system — Vercel/Linear-inspired dark
// Precision monochrome, one brand accent, semantic state colors, tight rhythm.

export const theme = {
  // ── Foreground hierarchy ─────────────────────────────────────
  fg: {
    primary: "#f0f0f0",    // body text, labels
    secondary: "#c8c8cc",  // meta text, subtitles
    tertiary: "#8a8f98",   // hints, timestamps, quiet labels
    quiet: "#585c63",      // borders, decorative, least important
  },

  // ── Surfaces ─────────────────────────────────────────────────
  surface: {
    canvas: "#090a0b",     // deepest background
    panel: "#0f1012",      // secondary surface
    elevated: "#18191b",   // cards, input areas
    border: "#2a2b30",     // visible borders
    subtle: "#1c1d21",     // very subtle dividers
  },

  // ── Brand accent ─────────────────────────────────────────────
  accent: {
    brand: "#818cf8",      // indigo-400 — single product accent
    warm: "#f0efe6",       // cream for emphasis on dark
  },

  // ── Semantic state ───────────────────────────────────────────
  state: {
    running: "#67e8f9",    // cyan-300 — active/running
    success: "#86efac",    // green-300 — complete/ready
    warning: "#fde68a",    // amber-200 — pending/caution
    danger: "#fca5a5",     // red-300 — errors/failures
  },

  // ── Diff colors ──────────────────────────────────────────────
  diff: {
    add: "#86efac",
    remove: "#fca5a5",
    hunk: "#818cf8",
    meta: "#8a8f98",
  },

  // ── Message role colors (sparse, semantic) ───────────────────
  role: {
    user: "#818cf8",
    assistant: "#f0f0f0",
    system: "#585c63",
    tool: "#67e8f9",
    error: "#fca5a5",
  },
};

// ── Backwards-compatible aliases ──────────────────────────────
// Existing component/test imports use old names; keep them alive
// while the UI migrates to semantic tokens.
// Remove after TUI rewrite confirms all refs are updated.
theme.text = theme.fg.primary;
theme.muted = theme.fg.tertiary;
theme.subtle = theme.fg.quiet;
theme.border = theme.surface.border;
theme.cyan = theme.state.running;
theme.green = theme.state.success;
theme.red = theme.state.danger;
theme.yellow = theme.state.warning;
theme.deletion = theme.diff.remove;
theme.addition = theme.diff.add;