import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export function safeId(value: string, label = "id"): string {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(cleaned)) {
    throw new Error(`Invalid ${label}. Use letters, numbers, dots, dashes, or underscores.`);
  }
  if (cleaned.includes("..") || cleaned.includes("/") || cleaned.includes("\\")) {
    throw new Error(`Invalid ${label}. Path traversal is not allowed.`);
  }
  return cleaned;
}

export function safeWorkspacePath(workspace: string, ...parts: string[]): string {
  const base = resolve(workspace);
  const target = resolve(base, ...parts);
  if (target !== base && !target.startsWith(`${base}/`)) {
    throw new Error("Refusing to write outside the AlphaFoundry workspace.");
  }
  return target;
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

export async function appendJsonl(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(value)}\n`, "utf8");
}

export function timestampId(prefix: string): string {
  return `${prefix}-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
}
