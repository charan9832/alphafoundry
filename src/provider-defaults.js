export const PROVIDER_DEFAULTS = Object.freeze({
  openai: { model: "gpt-4o-mini", apiKey: "OPENAI_API_KEY", baseUrl: "OPENAI_BASE_URL" },
  anthropic: { model: "claude-sonnet-4", apiKey: "ANTHROPIC_API_KEY", baseUrl: "ANTHROPIC_BASE_URL" },
  gemini: { model: "gemini-1.5-flash", apiKey: "GEMINI_API_KEY", baseUrl: "GEMINI_BASE_URL" },
  openrouter: { model: "openai/gpt-4o-mini", apiKey: "OPENROUTER_API_KEY", baseUrl: "OPENROUTER_BASE_URL" },
  default: { model: "default", apiKey: "ALPHAFOUNDRY_API_KEY", baseUrl: "" },
});

export function providerDefaults(provider) {
  return PROVIDER_DEFAULTS[String(provider ?? "").toLowerCase()] ?? PROVIDER_DEFAULTS.default;
}

export function knownProviderNames() {
  return Object.keys(PROVIDER_DEFAULTS).filter((name) => name !== "default");
}
