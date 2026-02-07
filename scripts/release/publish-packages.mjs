import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const raw = process.argv[2];

if (!raw || raw === "[]") {
  console.log("No released package paths provided. Skipping publish.");
  process.exit(0);
}

let paths;
try {
  paths = JSON.parse(raw);
} catch (error) {
  paths = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

if (!Array.isArray(paths) || paths.length === 0) {
  console.log("No released packages found. Skipping publish.");
  process.exit(0);
}

const rawFilters = paths
  .map((entry) => String(entry).replace(/\/+$/, ""))
  .filter((entry) => entry && entry !== ".");

if (rawFilters.length === 0) {
  console.log("No publishable packages found. Skipping publish.");
  process.exit(0);
}

const filters = Array.from(
  new Set(
    rawFilters.map((entry) => {
      const packageJsonPath = resolve(process.cwd(), entry, "package.json");
      if (!existsSync(packageJsonPath)) {
        return entry;
      }

      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      return packageJson.name ?? entry;
    })
  )
);

const args = [
  "-r",
  ...filters.flatMap((entry) => ["--filter", entry]),
  "publish",
  "--access",
  "public",
  "--no-git-checks",
];

const result = spawnSync("pnpm", args, { stdio: "inherit" });
process.exit(result.status ?? 1);
