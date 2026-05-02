import { redactUnknown } from "../redaction.js";

export const TOOL_PACK_SCHEMA_VERSION = 1;

export const DEFAULT_TOOL_PACK_REGISTRY = Object.freeze({
  schemaVersion: TOOL_PACK_SCHEMA_VERSION,
  packs: Object.freeze({}),
});

const RESERVED_DOMAIN_TERMS = Object.freeze([
  "finance",
  "financial",
  "trading",
  "trader",
  "broker",
  "exchange",
  "market",
  "market-data",
  "backtest",
  "portfolio",
  "order",
  "account",
]);

const PACK_ID_RE = /^[a-z][a-z0-9-]{1,63}$/;

function normalizePackId(id) {
  return String(id ?? "").trim().toLowerCase();
}

function hasReservedDomainTerm(id) {
  const normalized = normalizePackId(id);
  return RESERVED_DOMAIN_TERMS.some((term) => normalized === term || normalized.includes(term));
}

export function validateToolPackId(id) {
  const normalized = normalizePackId(id);
  if (!PACK_ID_RE.test(normalized)) {
    return { ok: false, id: normalized, reason: "Tool pack id must be kebab-case, 2-64 chars, and start with a letter." };
  }
  if (hasReservedDomainTerm(normalized)) {
    return { ok: false, id: normalized, reason: "Domain-specific tool pack ids are gated until an explicit opt-in pack policy exists." };
  }
  return { ok: true, id: normalized, reason: "Tool pack id is valid." };
}

export function createToolPackRegistry(packs = {}) {
  const normalizedPacks = {};
  for (const [rawId, rawPack] of Object.entries(packs ?? {})) {
    const idCheck = validateToolPackId(rawId);
    if (!idCheck.ok) throw new TypeError(idCheck.reason);
    const pack = rawPack ?? {};
    normalizedPacks[idCheck.id] = Object.freeze(redactUnknown({
      id: idCheck.id,
      name: String(pack.name ?? idCheck.id),
      description: String(pack.description ?? ""),
      enabledByDefault: false,
      tools: Array.isArray(pack.tools) ? pack.tools.map((tool) => String(tool)) : [],
      metadata: pack.metadata ?? {},
    }));
  }
  return Object.freeze({
    schemaVersion: TOOL_PACK_SCHEMA_VERSION,
    packs: Object.freeze(normalizedPacks),
  });
}

function deny(packId, reason, extra = {}) {
  return redactUnknown({
    schemaVersion: TOOL_PACK_SCHEMA_VERSION,
    packId: normalizePackId(packId),
    decision: "deny",
    enabled: false,
    reason,
    ...extra,
  });
}

export function resolveToolPackEnablement(options = {}) {
  const registry = options.registry ?? DEFAULT_TOOL_PACK_REGISTRY;
  const requested = Array.isArray(options.enable) ? options.enable : [];
  const decisions = [];
  const enabled = [];

  if (requested.length === 0) {
    return redactUnknown({
      schemaVersion: TOOL_PACK_SCHEMA_VERSION,
      decision: "allow",
      enabled: [],
      decisions,
      reason: "No optional tool packs requested; default registry is empty.",
    });
  }

  for (const rawId of requested) {
    const idCheck = validateToolPackId(rawId);
    if (!idCheck.ok) {
      decisions.push(deny(rawId, idCheck.reason));
      continue;
    }

    const pack = registry.packs?.[idCheck.id];
    if (!pack) {
      decisions.push(deny(idCheck.id, "Unknown tool pack; optional packs fail closed unless registered and explicitly enabled."));
      continue;
    }

    decisions.push(redactUnknown({
      schemaVersion: TOOL_PACK_SCHEMA_VERSION,
      packId: idCheck.id,
      decision: "allow",
      enabled: true,
      reason: "Registered optional tool pack explicitly enabled.",
      pack,
    }));
    enabled.push(idCheck.id);
  }

  return redactUnknown({
    schemaVersion: TOOL_PACK_SCHEMA_VERSION,
    decision: decisions.some((decision) => decision.decision === "deny") ? "deny" : "allow",
    enabled,
    decisions,
    reason: decisions.some((decision) => decision.decision === "deny")
      ? "One or more requested tool packs were denied."
      : "All requested tool packs were explicitly enabled.",
  });
}

export function summarizeToolPackStatus(options = {}) {
  const registry = options.registry ?? DEFAULT_TOOL_PACK_REGISTRY;
  const enablement = resolveToolPackEnablement({ registry, enable: options.enable ?? [] });
  const registered = Object.values(registry.packs ?? {}).map((pack) => redactUnknown({
    id: pack.id,
    name: pack.name,
    description: pack.description,
    enabledByDefault: pack.enabledByDefault,
    toolCount: Array.isArray(pack.tools) ? pack.tools.length : 0,
  }));

  return redactUnknown({
    schemaVersion: TOOL_PACK_SCHEMA_VERSION,
    product: "AlphaFoundry",
    registry: {
      schemaVersion: registry.schemaVersion ?? TOOL_PACK_SCHEMA_VERSION,
      defaultOptionalPacks: [],
      registered,
      registeredCount: registered.length,
    },
    enablement,
    status: enablement.decision === "deny" ? "gated" : "ready",
    boundary: {
      optionalPacksEnabledByDefault: false,
      domainPacksGated: true,
      executablePacksAvailable: false,
      mcpLoadingAvailable: false,
      nativeToolExecutionAvailable: false,
    },
    nextGate: "In-process generic execution skeleton is wired with permission, protected-path, redaction, and verification gates. Next: live approval integration, runner event integration, and first safe generic pack enablement UX.",
  });
}
