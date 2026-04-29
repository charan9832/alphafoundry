import { join, normalize } from "node:path";
import { homedir } from "node:os";

export function alphaFoundryHome(env = process.env) {
  if (env.ALPHAFOUNDRY_HOME) return normalize(env.ALPHAFOUNDRY_HOME);
  const home = env.HOME || env.USERPROFILE || homedir();
  return normalize(join(home, ".alphafoundry"));
}

export function dataDir(env = process.env) {
  if (env.ALPHAFOUNDRY_DATA_DIR) return normalize(env.ALPHAFOUNDRY_DATA_DIR);
  return normalize(join(alphaFoundryHome(env), "data"));
}

export function sessionsDir(env = process.env) {
  if (env.ALPHAFOUNDRY_SESSIONS_DIR) return normalize(env.ALPHAFOUNDRY_SESSIONS_DIR);
  return normalize(join(alphaFoundryHome(env), "sessions"));
}
