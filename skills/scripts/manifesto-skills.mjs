#!/usr/bin/env node

import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "@manifesto-ai/skills";
const CODEX_SKILL_NAME = "manifesto";
const MANAGED_MARKER = ".manifesto-codex-install.json";
const COPY_ENTRIES = [
  "SKILL.md",
  "knowledge",
  "tracking",
  "scripts",
  "claude-code",
  "package.json",
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(__dirname, "..");
const packageJson = JSON.parse(
  await readFile(resolve(skillsRoot, "package.json"), "utf8"),
);
const version = packageJson.version ?? "0.0.0";
const codexHome = resolve(process.env.CODEX_HOME ?? resolve(homedir(), ".codex"));
const codexSkillsRoot = resolve(codexHome, "skills");
const codexSkillDir = resolve(codexSkillsRoot, CODEX_SKILL_NAME);

const [command] = process.argv.slice(2);

switch (command) {
  case "install-codex":
    await runInstallCodex();
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
}

async function runInstallCodex() {
  await mkdir(codexSkillsRoot, { recursive: true });

  const existingState = await inspectExistingInstall();
  if (existingState === "foreign") {
    console.error(
      `Refusing to overwrite existing non-managed skill at ${codexSkillDir}`,
    );
    console.error(
      "Remove or rename that skill directory first, then rerun install-codex.",
    );
    process.exitCode = 1;
    return;
  }

  await rm(codexSkillDir, { recursive: true, force: true });
  await mkdir(codexSkillDir, { recursive: true });

  for (const entry of COPY_ENTRIES) {
    const source = resolve(skillsRoot, entry);
    if (!existsSync(source)) {
      continue;
    }

    const destination = resolve(codexSkillDir, entry);
    await cp(source, destination, {
      recursive: true,
      force: true,
    });
  }

  await writeFile(
    resolve(codexSkillDir, MANAGED_MARKER),
    JSON.stringify(
      {
        packageName: PACKAGE_NAME,
        version,
        sourceRoot: skillsRoot,
        installedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(
    `${existingState === "managed" ? "Updated" : "Installed"} Codex skill "${CODEX_SKILL_NAME}" at ${codexSkillDir}`,
  );
  console.log("Restart Codex to pick up the installed skill.");
}

async function inspectExistingInstall() {
  if (!existsSync(codexSkillDir)) {
    return "missing";
  }

  const markerPath = resolve(codexSkillDir, MANAGED_MARKER);
  if (existsSync(markerPath)) {
    try {
      const marker = JSON.parse(await readFile(markerPath, "utf8"));
      if (marker?.packageName === PACKAGE_NAME) {
        return "managed";
      }
    } catch {
      return "foreign";
    }
  }

  try {
    const packageStat = await stat(resolve(codexSkillDir, "package.json"));
    const skillStat = await stat(resolve(codexSkillDir, "SKILL.md"));
    if (packageStat.isFile() && skillStat.isFile()) {
      const installedPackageJson = JSON.parse(
        await readFile(resolve(codexSkillDir, "package.json"), "utf8"),
      );
      if (installedPackageJson?.name === PACKAGE_NAME) {
        return "managed";
      }
    }
  } catch {
    return "foreign";
  }

  return "foreign";
}

function printHelp() {
  console.log(`manifesto-skills v${version}

Usage:
  manifesto-skills install-codex

Commands:
  install-codex   Install or update the managed Codex skill at $CODEX_HOME/skills/${CODEX_SKILL_NAME}
  help            Show this message
`);
}
