#!/usr/bin/env node
/**
 * Manifesto Translator CLI
 *
 * Interactive CLI for translating natural language to semantic changes.
 *
 * Usage:
 *   manifesto-translate -w <world-id> "Your request here"
 *   manifesto-translate -w <world-id> --file requirements.txt
 *   cat input.txt | manifesto-translate -w <world-id> --stdin
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
 */
function loadEnvFiles(): void {
  const envFiles = [".env.local", ".env"];
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    for (const envFile of envFiles) {
      const envPath = path.join(currentDir, envFile);
      if (fs.existsSync(envPath)) {
        try {
          const content = fs.readFileSync(envPath, "utf-8");
          for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;

            const eqIndex = trimmed.indexOf("=");
            if (eqIndex === -1) continue;

            const key = trimmed.slice(0, eqIndex).trim();
            let value = trimmed.slice(eqIndex + 1).trim();

            if (
              (value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))
            ) {
              value = value.slice(1, -1);
            }

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
    $ manifesto-translate [options] <input>

  Options
    --world, -w   World ID (required)
    --schema      Path to schema JSON file

    --simple      Minimal output (default)
    --verbose     Show stage progress
    --full        Show full trace

    --provider    LLM provider: openai (default) or anthropic
    --api-key     API key (or use OPENAI_API_KEY / ANTHROPIC_API_KEY env)
    --model       Model name override

    --file        Read input from file
    --stdin       Read input from stdin
    --output, -o  Write result JSON to file

    --trace       Write trace JSON to file

  Examples
    $ manifesto-translate -w my-world "Add email field to user profile"
    $ manifesto-translate -w my-world --provider anthropic "Create a counter"
    $ cat input.txt | manifesto-translate -w my-world --stdin -o result.json
    $ manifesto-translate -w my-world --file requirements.txt --verbose
`,
  {
    importMeta: import.meta,
    flags: {
      world: { type: "string", shortFlag: "w" },
      schema: { type: "string" },
      simple: { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
      full: { type: "boolean", default: false },
      provider: { type: "string", default: "openai" },
      apiKey: { type: "string" },
      model: { type: "string" },
      file: { type: "string" },
      stdin: { type: "boolean", default: false },
      output: { type: "string", shortFlag: "o" },
      trace: { type: "string" },
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
  console.error(
    `Error: Invalid provider "${value}". Use "openai" or "anthropic".`
  );
  process.exit(1);
}

async function main() {
  // World ID is required
  if (!cli.flags.world) {
    console.error("Error: World ID required. Use --world or -w flag.");
    process.exit(1);
  }

  const provider = validateProvider(cli.flags.provider);

  // Get API key based on provider
  const apiKey =
    cli.flags.apiKey ||
    (provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY);

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
    console.error("\nUsage: manifesto-translate -w <world-id> <input>");
    console.error("       manifesto-translate -w <world-id> --file <file>");
    console.error("       cat <file> | manifesto-translate -w <world-id> --stdin");
    process.exit(1);
  }

  // Load schema if provided
  let schema: unknown = undefined;
  if (cli.flags.schema) {
    try {
      const schemaContent = fs.readFileSync(cli.flags.schema, "utf-8");
      schema = JSON.parse(schemaContent);
    } catch (error) {
      console.error(`Error: Could not read schema file "${cli.flags.schema}"`);
      process.exit(1);
    }
  }

  const verbosity = getVerbosity(cli.flags);

  // Render the Ink app
  const { waitUntilExit } = render(
    <App
      input={input.trim()}
      worldId={cli.flags.world}
      schema={schema}
      provider={provider}
      apiKey={apiKey}
      model={cli.flags.model}
      verbosity={verbosity}
      outputFile={cli.flags.output}
      traceFile={cli.flags.trace}
    />
  );

  // Wait for the app to exit
  await waitUntilExit();
}

main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
