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

function isPortableAbsolute(path) {
  return isAbsolute(path) || /^[A-Za-z]:[\\/]/.test(path) || /^\\\\/.test(path);
}

function credentialPathCategory(path) {
  if (/(^|\/)\.env($|\.)/.test(path)) return "env";
  if (/(^|\/)\.ssh(\/|$)|(^|\/)id_rsa$|(^|\/)id_ed25519$/.test(path)) return "ssh";
  if (/(^|\/)\.aws\/credentials$|(^|\/)\.config\/gcloud\/|(^|\/)\.azure(\/|$)/.test(path)) return "cloud";
  if (/(^|\/)\.npmrc$|(^|\/)\.yarnrc(\.yml)?$|(^|\/)\.pnpmrc$/.test(path)) return "npm-token";
  if (/(^|\/)\.netrc$/.test(path)) return "netrc";
  if (/(^|\/)\.docker\/config\.json$/.test(path)) return "docker";
  if (/(^|\/)\.kube\/config$/.test(path)) return "kube";
  return null;
}

export function normalizeWorkspacePath(path, workspace, options = {}) {
  const home = options.home ?? homedir();
  const expanded = expandHome(path, home);
  const portable = expanded.replaceAll("\\", sep);
  const base = normalize(workspace ?? process.cwd());
  return normalize(isPortableAbsolute(expanded) || isPortableAbsolute(portable) ? portable : resolve(base, portable));
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
  const credentialCategory = credentialPathCategory(lower);
  const fullCredentialCategory = credentialPathCategory(fullLower);

  if (!isPathInsideWorkspace(path, workspace, { home })) {
    if (isAlphaFoundryState(fullPath, options)) return { protected: true, category: "alphafoundry-state", path: fullPath };
    if (fullCredentialCategory) return { protected: true, category: fullCredentialCategory, path: fullPath };
    return { protected: true, category: "outside-workspace", path: fullPath };
  }

  if (lower === ".git" || lower.startsWith(".git/")) return { protected: true, category: "git", path: fullPath };
  if (credentialCategory) return { protected: true, category: credentialCategory, path: fullPath };
  if (isAlphaFoundryState(fullPath, options)) return { protected: true, category: "alphafoundry-state", path: fullPath };

  return { protected: false, category: null, path: fullPath };
}
