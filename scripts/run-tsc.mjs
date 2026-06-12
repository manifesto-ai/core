#!/usr/bin/env node
/**
 * Root-owned tsc invocation (#423).
 *
 * Package scripts delegate here instead of resolving the tool through
 * relative node_modules paths, so the workspace owns exactly one contract
 * for which TypeScript compiles/typechecks regardless of execution root.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");

const result = spawnSync(process.execPath, [tsc, ...process.argv.slice(2)], { stdio: "inherit" });

process.exit(result.status ?? 1);
