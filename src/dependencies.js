import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const requireFromHere = createRequire(import.meta.url);

export function packageRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

export function resolvePackagePath(specifier) {
  return requireFromHere.resolve(specifier);
}

export function findNodeModulePackageRoot(packageName, start = dirname(fileURLToPath(import.meta.url))) {
  let current = start;
  while (true) {
    const candidate = join(current, "node_modules", ...packageName.split("/"), "package.json");
    if (existsSync(candidate)) return dirname(candidate);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`Unable to resolve package ${packageName} from ${start}`);
}

export function resolvePiCliPath() {
  return join(findNodeModulePackageRoot("@mariozechner/pi-coding-agent"), "dist", "cli.js");
}

export function resolvePiPackageJsonPath() {
  return join(findNodeModulePackageRoot("@mariozechner/pi-coding-agent"), "package.json");
}

export function resolvePiRpcClientUrl() {
  return pathToFileURL(join(dirname(resolvePiCliPath()), "modes", "rpc", "rpc-client.js")).href;
}

export function resolveTsxLoaderUrl() {
  return pathToFileURL(resolvePackagePath("tsx")).href;
}
