---
version: alpha
name: AlphaFoundry
description: Terminal AI workspace — dark, precise, motion-first. Precision monochrome with indigo accent. Geist-like compression on headers, Linear-like luminance hierarchy.
colors:
  canvas: "#08090a"
  panel: "#0f1012"
  elevated: "#18191b"
  border: "#2a2b30"
  subtle: "#1c1d21"
  fg:
    primary: "#f0f0f0"
    secondary: "#c8c8cc"
    tertiary: "#8a8f98"
    quiet: "#585c63"
  accent:
    brand: "#818cf8"
    warm: "#f0efe6"
  state:
    running: "#67e8f9"
    success: "#86efac"
    warning: "#fde68a"
    danger: "#fca5a5"
  diff:
    add: "#86efac"
    remove: "#fca5a5"
    hunk: "#818cf8"
    meta: "#8a8f98"
  role:
    user: "#818cf8"
    assistant: "#f0f0f0"
    system: "#585c63"
    tool: "#67e8f9"
    error: "#fca5a5"
typography:
  wordmark:
    fontFamily: system monospace
    fontSize: 1
    fontWeight: bold
  label:
    fontFamily: system monospace
    fontSize: 1
    fontWeight: normal
  body:
    fontFamily: system monospace
    fontSize: 1
    fontWeight: normal
shapes:
  radius:
    sm: 1
    md: 2
    lg: 3
spacing:
  xs: 1
  sm: 2
  md: 4
  lg: 8
components:
  status-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.fg.primary}"
    height: 1
  prompt-card:
    backgroundColor: "{colors.elevated}"
    borderColor: "{colors.border}"
    padding: 1
  message:
    labelColor: "{colors.fg.tertiary}"
    bodyColor: "{colors.fg.secondary}"
    indentColor: "{colors.subtle}"
  sidebar-section:
    labelColor: "{colors.fg.quiet}"
    valueColor: "{colors.fg.secondary}"
    emptyColor: "{colors.fg.tertiary}"
  spinner:
    activeColor: "{colors.state.running}"
    idleColor: "{colors.fg.tertiary}"
---