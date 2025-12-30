#!/usr/bin/env node
/**
 * Manifesto Compiler CLI
 *
 * Interactive CLI for compiling natural language to Manifesto DomainSchema.
 *
 * Usage:
 *   manifesto-compile "Your requirements here"
 *   manifesto-compile --file requirements.txt
 *   cat requirements.txt | manifesto-compile --stdin
 */

import React from "react";
import { render } from "ink";
import meow from "meow";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { App } from "./App.js";
import type { Provider, Verbosity } from "./types.js";

/**
 * Load environment variables from .env and .env.local files
 * Searches from current directory up to root
 */
function loadEnvFiles(): void {
  const envFiles = [".env.local", ".env"];
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  // Walk up the directory tree
  while (currentDir !== root) {
    for (const envFile of envFiles) {
      const envPath = path.join(currentDir, envFile);
      if (fs.existsSync(envPath)) {
        try {
          const content = fs.readFileSync(envPath, "utf-8");
          // Parse and set environment variables (don't override existing)
          for (const line of content.split("\n")) {
            const trimmed = line.trim();
            // Skip comments and empty lines
            if (!trimmed || trimmed.startsWith("#")) continue;

            const eqIndex = trimmed.indexOf("=");
            if (eqIndex === -1) continue;

            const key = trimmed.slice(0, eqIndex).trim();
            let value = trimmed.slice(eqIndex + 1).trim();

            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }

            // Don't override existing environment variables
            if (!(key in process.env)) {
              process.env[key] = value;
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    }
    currentDir = path.dirname(currentDir);
  }
}

// Load env files before anything else
loadEnvFiles();

const cli = meow(
  `
  Usage
    $ manifesto-compile <input>

  Options
    --simple      Minimal output (default)
    --verbose     Show phase progress
    --full        Show full metrics

    --provider    LLM provider: openai (default) or anthropic
    --api-key     API key (or use OPENAI_API_KEY / ANTHROPIC_API_KEY env)
    --model       Model name (default: gpt-4o-mini / claude-3-haiku-20240307)

    --file        Read input from file
    --stdin       Read input from stdin
    --output, -o  Write result JSON to file (default: stdout)

  Examples
    $ manifesto-compile "Track user name and email"
    $ manifesto-compile --provider anthropic "Create a counter"
    $ cat requirements.txt | manifesto-compile --stdin -o schema.json
    $ manifesto-compile --file requirements.txt --verbose
`,
  {
    importMeta: import.meta,
    flags: {
      simple: { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
      full: { type: "boolean", default: false },
      provider: { type: "string", default: "openai" },
      apiKey: { type: "string" },
      model: { type: "string" },
      file: { type: "string" },
      stdin: { type: "boolean", default: false },
      output: { type: "string", shortFlag: "o" },
    },
  }
);

/**
 * Read input from stdin
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    const lines: string[] = [];

    rl.on("line", (line) => {
      lines.push(line);
    });

    rl.on("close", () => {
      resolve(lines.join("\n"));
    });

    rl.on("error", reject);
  });
}

/**
 * Get verbosity level from flags
 */
function getVerbosity(flags: typeof cli.flags): Verbosity {
  if (flags.full) return "full";
  if (flags.verbose) return "verbose";
  return "simple";
}

/**
 * Validate provider value
 */
function validateProvider(value: string): Provider {
  if (value === "openai" || value === "anthropic") {
    return value;
  }
  console.error(`Error: Invalid provider "${value}". Use "openai" or "anthropic".`);
  process.exit(1);
}

async function main() {
  const provider = validateProvider(cli.flags.provider);

  // Get API key based on provider
  const apiKey =
    cli.flags.apiKey ||
    (provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY);

  if (!apiKey) {
    const envVar = provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
    console.error(`Error: API key required. Set ${envVar} environment variable or use --api-key flag.`);
    process.exit(1);
  }

  // Read input from various sources
  let input: string;

  if (cli.flags.stdin) {
    input = await readStdin();
  } else if (cli.flags.file) {
    try {
      input = fs.readFileSync(cli.flags.file, "utf-8");
    } catch (error) {
      console.error(`Error: Could not read file "${cli.flags.file}"`);
      process.exit(1);
    }
  } else {
    input = cli.input.join(" ");
  }

  if (!input.trim()) {
    console.error("Error: No input provided");
    console.error("\nUsage: manifesto-compile <input>");
    console.error("       manifesto-compile --file <file>");
    console.error("       cat <file> | manifesto-compile --stdin");
    process.exit(1);
  }

  const verbosity = getVerbosity(cli.flags);

  // Render the Ink app
  const { waitUntilExit } = render(
    <App
      input={input.trim()}
      provider={provider}
      apiKey={apiKey}
      model={cli.flags.model}
      verbosity={verbosity}
      outputFile={cli.flags.output}
    />
  );

  // Wait for the app to exit
  await waitUntilExit();
}

main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
