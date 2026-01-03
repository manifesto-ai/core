import { spawnSync } from "node:child_process";

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

const filters = paths
  .map((entry) => String(entry).replace(/\/+$/, ""))
  .filter((entry) => entry && entry !== ".");

if (filters.length === 0) {
  console.log("No publishable packages found. Skipping publish.");
  process.exit(0);
}

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
