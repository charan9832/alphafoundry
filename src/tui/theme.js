export const theme = {
  fg: {
    primary: "#f7f8f8",
    secondary: "#d0d6e0",
    tertiary: "#8a8f98",
    quiet: "#62666d",
  },
  surface: {
    canvas: "#08090a",
    panel: "#0f1011",
    elevated: "#191a1b",
    border: "#34343a",
    subtleBorder: "#23252a",
  },
  accent: {
    brand: "#7170ff",
    focus: "#828fff",
    warm: "#faf9f6",
  },
  state: {
    running: "#67e8f9",
    success: "#86efac",
    warning: "#fde68a",
    danger: "#fca5a5",
  },
  diff: {
    add: "#86efac",
    remove: "#fca5a5",
    hunk: "#828fff",
    meta: "#8a8f98",
  },
};

// Backwards-compatible aliases for existing components/tests while the TUI migrates
// to semantic visual tokens.
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
