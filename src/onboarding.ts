import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFileSync } from "node:fs";
import type { ProviderKind, SearchConfig, SearchProviderKind } from "./types.js";

export interface OnboardAnswers {
  provider: ProviderKind;
  model: string;
  apiKeyEnv?: string | undefined;
  baseUrl?: string | undefined;
  workspace: string;
  search: SearchConfig;
}

export interface SearchProbeResult {
  provider: Exclude<SearchProviderKind, "none">;
  endpoint: string;
}

const PROVIDERS: ProviderKind[] = ["local", "openrouter", "openai-compatible", "azure-openai", "anthropic", "gemini"];
export function defaultModelForProvider(provider: ProviderKind): string {
  switch (provider) {
    case "local": return "local-agent";
    case "openrouter": return "openrouter/free";
    case "openai-compatible": return "gpt-4o-mini";
    case "azure-openai": return "gpt-4o-mini";
    case "anthropic": return "claude-3-5-sonnet-latest";
    case "gemini": return "gemini-1.5-flash";
  }
}

export function defaultApiKeyEnvForProvider(provider: ProviderKind): string {
  switch (provider) {
    case "local": return "";
    case "openrouter": return "OPENROUTER_API_KEY";
    case "openai-compatible": return "OPENAI_API_KEY";
    case "azure-openai": return "AZURE_OPENAI_API_KEY";
    case "anthropic": return "ANTHROPIC_API_KEY";
    case "gemini": return "GEMINI_API_KEY";
  }
}

export function isValidProvider(value: string): value is ProviderKind {
  return PROVIDERS.includes(value.trim() as ProviderKind);
}

export function parseProvider(value: string, fallback: ProviderKind = "local"): ProviderKind {
  const normalized = value.trim() as ProviderKind;
  return PROVIDERS.includes(normalized) ? normalized : fallback;
}

export async function askOnboardingQuestions(defaults: {
  provider: ProviderKind;
  model: string;
  apiKeyEnv?: string | undefined;
  baseUrl?: string | undefined;
  workspace: string;
  search?: SearchConfig | undefined;
}): Promise<OnboardAnswers> {
  if (!input.isTTY) return askOnboardingQuestionsFromPipedInput(defaults);
  const rl = createInterface({ input, output });
  try {
    console.log("AlphaFoundry onboarding");
    console.log(`Providers: ${PROVIDERS.join(", ")}`);
    const providerInput = await ask(rl, `Choose LLM provider`, defaults.provider);
    if (!isValidProvider(providerInput)) throw new Error(`Invalid provider: ${providerInput}`);
    const provider = parseProvider(providerInput, defaults.provider);
    const providerChanged = provider !== defaults.provider;
    const model = await ask(rl, "Model", providerChanged ? defaultModelForProvider(provider) : (defaults.model || defaultModelForProvider(provider)));
    const apiKeyEnv = cleanOptional(await ask(rl, "API key env var name (name only, not the key value)", providerChanged ? defaultApiKeyEnvForProvider(provider) : (defaults.apiKeyEnv ?? defaultApiKeyEnvForProvider(provider))));
    const baseUrl = cleanOptional(await ask(rl, "Base URL (blank unless custom/Azure/OpenAI-compatible)", defaults.baseUrl ?? ""));
    const workspace = await ask(rl, "Workspace path", defaults.workspace);

    console.log(`Configure web search: auto, searxng, firecrawl, custom, none`);
    const searchChoice = (await ask(rl, "Search provider", defaults.search?.provider ?? "auto")).trim().toLowerCase();
    const search = await searchConfigFromChoice(searchChoice, defaults.search);
    return { provider, model, apiKeyEnv, baseUrl, workspace, search };
  } finally {
    rl.close();
  }
}

async function askOnboardingQuestionsFromPipedInput(defaults: {
  provider: ProviderKind;
  model: string;
  apiKeyEnv?: string | undefined;
  baseUrl?: string | undefined;
  workspace: string;
  search?: SearchConfig | undefined;
}): Promise<OnboardAnswers> {
  const lines = readFileSync(0, "utf8").split(/\r?\n/);
  let index = 0;
  const next = (prompt: string, fallback: string): string => {
    output.write(`${prompt}${fallback ? ` [${fallback}]` : ""}: `);
    const raw = lines[index++] ?? "";
    output.write("\n");
    return raw.trim() || fallback;
  };

  console.log("AlphaFoundry onboarding");
  console.log(`Providers: ${PROVIDERS.join(", ")}`);
  const providerInput = next("Choose LLM provider", defaults.provider);
  if (!isValidProvider(providerInput)) throw new Error(`Invalid provider: ${providerInput}`);
  const provider = parseProvider(providerInput, defaults.provider);
  const providerChanged = provider !== defaults.provider;
  const model = next("Model", providerChanged ? defaultModelForProvider(provider) : (defaults.model || defaultModelForProvider(provider)));
  const apiKeyEnv = cleanOptional(next("API key env var name (name only, not the key value)", providerChanged ? defaultApiKeyEnvForProvider(provider) : (defaults.apiKeyEnv ?? defaultApiKeyEnvForProvider(provider))));
  const baseUrl = cleanOptional(next("Base URL (blank unless custom/Azure/OpenAI-compatible)", defaults.baseUrl ?? ""));
  const workspace = next("Workspace path", defaults.workspace);
  console.log("Configure web search: auto, searxng, firecrawl, custom, none");
  const searchChoice = next("Search provider", defaults.search?.provider ?? "auto").trim().toLowerCase();
  let search: SearchConfig;
  if (searchChoice === "none") search = { provider: "none" };
  else if (searchChoice === "auto" || !searchChoice) {
    const detected = await detectLocalSearch();
    search = detected ? { provider: detected.provider, endpoint: detected.endpoint, autoDetected: true } : { provider: "none" };
  } else if (searchChoice === "searxng" || searchChoice === "firecrawl" || searchChoice === "custom") {
    const endpoint = next("Search endpoint", defaults.search?.endpoint ?? (searchChoice === "searxng" ? "http://127.0.0.1:8080/search" : searchChoice === "firecrawl" ? "http://127.0.0.1:3002" : ""));
    const searchApiKeyEnv = cleanOptional(next("Search API key env var name (blank for none)", defaults.search?.apiKeyEnv ?? ""));
    search = { provider: searchChoice, endpoint, apiKeyEnv: searchApiKeyEnv };
  } else {
    throw new Error(`Invalid search provider: ${searchChoice}`);
  }
  return { provider, model, apiKeyEnv, baseUrl, workspace, search };
}

async function ask(rl: ReturnType<typeof createInterface>, prompt: string, fallback: string): Promise<string> {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = await rl.question(`${prompt}${suffix}: `);
  return answer.trim() || fallback;
}

function cleanOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

async function searchConfigFromChoice(choice: string, existing?: SearchConfig): Promise<SearchConfig> {
  if (choice === "none") return { provider: "none" };
  if (choice === "auto" || !choice) {
    const detected = await detectLocalSearch();
    return detected ? { provider: detected.provider, endpoint: detected.endpoint, autoDetected: true } : { provider: "none" };
  }
  if (choice === "searxng" || choice === "firecrawl" || choice === "custom") {
    const rl = createInterface({ input, output });
    try {
      const defaultEndpoint = existing?.endpoint ?? (choice === "searxng" ? "http://127.0.0.1:8080/search" : choice === "firecrawl" ? "http://127.0.0.1:3002" : "");
      const endpoint = await ask(rl, "Search endpoint", defaultEndpoint);
      const apiKeyEnv = cleanOptional(await ask(rl, "Search API key env var name (blank for none)", existing?.apiKeyEnv ?? ""));
      return { provider: choice, endpoint, apiKeyEnv } as SearchConfig;
    } finally {
      rl.close();
    }
  }
  throw new Error(`Invalid search provider: ${choice}`);
}

export function defaultSearchProbeUrls(): string[] {
  return [
    "http://127.0.0.1:8080/search",
    "http://localhost:8080/search",
    "http://127.0.0.1:8888/search",
    "http://localhost:8888/search",
    "http://127.0.0.1:3002/v1/search",
    "http://localhost:3002/v1/search",
  ];
}

export async function detectLocalSearch(probes = defaultSearchProbeUrls(), fetchImpl: typeof fetch = fetch): Promise<SearchProbeResult | null> {
  for (const endpoint of probes) {
    const provider = inferSearchProvider(endpoint);
    try {
      const url = new URL(endpoint);
      if (provider === "searxng") {
        url.searchParams.set("q", "alphafoundry");
        url.searchParams.set("format", "json");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      try {
        const response = await fetchImpl(url, { method: "GET", signal: controller.signal, headers: { accept: "application/json" } });
        if (response.ok || response.status === 401 || response.status === 403) return { provider, endpoint };
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Try the next local probe.
    }
  }
  return null;
}

export function inferSearchProvider(endpoint: string): Exclude<SearchProviderKind, "none"> {
  const lower = endpoint.toLowerCase();
  if (lower.includes("firecrawl") || lower.includes(":3002")) return "firecrawl";
  if (lower.includes("searx") || lower.includes("/search") || lower.includes(":8080") || lower.includes(":8888")) return "searxng";
  return "custom";
}
