import { mergeLocalEnv } from "./config.js";

export function buildTuiEnv(env = process.env) {
  return mergeLocalEnv(env);
}
