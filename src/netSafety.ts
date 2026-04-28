export function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

export function isLoopbackHost(host: string): boolean {
  const normalized = normalizeHost(host);
  const mapped = extractIpv4MappedIpv6(normalized);
  const ipv4 = mapped ?? normalized;
  return normalized === "localhost" || normalized === "::1" || ipv4.startsWith("127.");
}

export function isPrivateOrLinkLocalHost(host: string): boolean {
  const normalized = normalizeHost(host);
  const mapped = extractIpv4MappedIpv6(normalized);
  const ipv4 = mapped ?? normalized;
  if (isPrivateOrLinkLocalIpv4(ipv4)) return true;
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;
  if (normalized === "metadata.google.internal") return true;
  if (isIpv6Literal(normalized)) {
    return normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
  }
  return false;
}

function isPrivateOrLinkLocalIpv4(host: string): boolean {
  return host === "0.0.0.0"
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    || /^169\.254\./.test(host);
}

function isIpv6Literal(host: string): boolean {
  return host.includes(":");
}

function extractIpv4MappedIpv6(host: string): string | null {
  const dotted = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) return dotted[1] ?? null;
  const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hex) return null;
  const high = Number.parseInt(hex[1] ?? "", 16);
  const low = Number.parseInt(hex[2] ?? "", 16);
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}
