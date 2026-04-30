import { homedir } from "node:os";
import { isAbsolute, normalize, resolve, sep } from "node:path";
import { alphaFoundryHome } from "../paths.js";

function slashPath(value) {
  return String(value ?? "").replaceAll("\\", "/");
}

function expandHome(input, home = homedir()) {
  const text = String(input ?? "");
  if (text === "~") return home;
  if (text.startsWith("~/") || text.startsWith("~\\")) return `${home}${text.slice(1)}`;
  return text;
}

function withTrailingSep(path) {
  return path.endsWith(sep) ? path : `${path}${sep}`;
}

export function normalizeWorkspacePath(path, workspace, options = {}) {
  const home = options.home ?? homedir();
  const expanded = expandHome(path, home);
  const portable = expanded.replaceAll("\\", sep);
  const base = normalize(workspace ?? process.cwd());
  return normalize(isAbsolute(portable) ? portable : resolve(base, portable));
}

export function isPathInsideWorkspace(path, workspace, options = {}) {
  const base = normalize(workspace ?? process.cwd());
  const full = normalizeWorkspacePath(path, base, options);
  return full === base || full.startsWith(withTrailingSep(base));
}

function relativePortable(fullPath, workspace, options = {}) {
  const base = normalize(workspace ?? process.cwd());
  const full = normalizeWorkspacePath(fullPath, base, options);
  if (full === base) return "";
  if (full.startsWith(withTrailingSep(base))) return slashPath(full.slice(withTrailingSep(base).length));
  return slashPath(full);
}

function isAlphaFoundryState(fullPath, options = {}) {
  const home = normalize(options.alphaFoundryHome ?? alphaFoundryHome(options.env ?? process.env));
  return fullPath === home || fullPath.startsWith(withTrailingSep(home));
}

export function classifyProtectedPath(path, options = {}) {
  const workspace = normalize(options.workspace ?? process.cwd());
  const home = options.home ?? homedir();
  const fullPath = normalizeWorkspacePath(path, workspace, { home });
  const rel = relativePortable(path, workspace, { home });
  const lower = slashPath(rel).toLowerCase();
  const fullLower = slashPath(fullPath).toLowerCase();

  if (!isPathInsideWorkspace(path, workspace, { home })) {
    if (isAlphaFoundryState(fullPath, options)) return { protected: true, category: "alphafoundry-state", path: fullPath };
    if (/(^|\/)\.ssh(\/|$)|(^|\/)id_rsa$|(^|\/)id_ed25519$/.test(fullLower)) return { protected: true, category: "ssh", path: fullPath };
    if (/(^|\/)\.aws\/credentials$|(^|\/)\.config\/gcloud\//.test(fullLower)) return { protected: true, category: "cloud", path: fullPath };
    if (/(^|\/)\.npmrc$|(^|\/)\.yarnrc(\.yml)?$|(^|\/)\.pnpmrc$/.test(fullLower)) return { protected: true, category: "npm-token", path: fullPath };
    return { protected: true, category: "outside-workspace", path: fullPath };
  }

  if (lower === ".git" || lower.startsWith(".git/")) return { protected: true, category: "git", path: fullPath };
  if (lower === ".env" || lower.startsWith(".env.")) return { protected: true, category: "env", path: fullPath };
  if (/(^|\/)\.ssh(\/|$)|(^|\/)id_rsa$|(^|\/)id_ed25519$/.test(lower)) return { protected: true, category: "ssh", path: fullPath };
  if (/(^|\/)\.aws\/credentials$|(^|\/)\.config\/gcloud\//.test(lower)) return { protected: true, category: "cloud", path: fullPath };
  if (/(^|\/)\.npmrc$|(^|\/)\.yarnrc(\.yml)?$|(^|\/)\.pnpmrc$/.test(lower)) return { protected: true, category: "npm-token", path: fullPath };
  if (isAlphaFoundryState(fullPath, options)) return { protected: true, category: "alphafoundry-state", path: fullPath };

  return { protected: false, category: null, path: fullPath };
}
