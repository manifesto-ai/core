#!/usr/bin/env npx tsx
/**
 * LLM-BabyBench Dataset Downloader
 *
 * Downloads benchmark data from HuggingFace and caches it locally.
 *
 * Usage:
 *   npx tsx scripts/download-dataset.ts              # Download all configs
 *   npx tsx scripts/download-dataset.ts predict      # Download specific config
 *   npx tsx scripts/download-dataset.ts --info       # Show cache status
 *   npx tsx scripts/download-dataset.ts --force      # Force re-download
 *   npx tsx scripts/download-dataset.ts --clear      # Clear cache
 */

import { parseArgs } from "util";
import {
  downloadDataset,
  getDatasetMetadata,
  isCached,
  clearCache,
} from "../src/dataset/index.js";
import type { DatasetConfig } from "../src/dataset/types.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "../.cache");

const ALL_CONFIGS: DatasetConfig[] = ["decompose", "plan", "predict"];

interface Config {
  configs: DatasetConfig[];
  info: boolean;
  force: boolean;
  clear: boolean;
}

function parseConfig(): Config {
  const { values, positionals } = parseArgs({
    options: {
      info: { type: "boolean", short: "i", default: false },
      force: { type: "boolean", short: "f", default: false },
      clear: { type: "boolean", short: "c", default: false },
    },
    allowPositionals: true,
  });

  const configs: DatasetConfig[] = positionals.length > 0
    ? positionals.filter((p): p is DatasetConfig =>
        ALL_CONFIGS.includes(p as DatasetConfig)
      )
    : ALL_CONFIGS;

  return {
    configs,
    info: values.info as boolean,
    force: values.force as boolean,
    clear: values.clear as boolean,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function showInfo(): Promise<void> {
  console.log("\n=== LLM-BabyBench Dataset Cache Status ===\n");

  for (const config of ALL_CONFIGS) {
    const cached = isCached(config);
    const cachePath = path.join(CACHE_DIR, `${config}.json`);

    if (cached) {
      const stats = fs.statSync(cachePath);
      const data = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      console.log(`[${config}]`);
      console.log(`  Status: ✅ Cached`);
      console.log(`  Rows: ${data.length}`);
      console.log(`  Size: ${formatBytes(stats.size)}`);
      console.log(`  Modified: ${stats.mtime.toLocaleString()}`);
    } else {
      console.log(`[${config}]`);
      console.log(`  Status: ❌ Not cached`);

      // Try to get metadata from HuggingFace
      try {
        const metadata = await getDatasetMetadata(config);
        console.log(`  Available rows: ${metadata.totalRows}`);
        console.log(`  Level names: ${metadata.levelNames.join(", ")}`);
      } catch {
        console.log(`  (Unable to fetch metadata)`);
      }
    }
    console.log();
  }
}

async function downloadAll(configs: DatasetConfig[], force: boolean): Promise<void> {
  console.log("\n=== LLM-BabyBench Dataset Downloader ===\n");
  console.log("Note: HuggingFace API may be slow. Retry logic with exponential backoff is enabled.\n");

  for (const config of configs) {
    const cached = isCached(config);

    if (cached && !force) {
      const cachePath = path.join(CACHE_DIR, `${config}.json`);
      const data = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      console.log(`[${config}] Already cached (${data.length} rows). Use --force to re-download.`);
      continue;
    }

    if (cached && force) {
      console.log(`[${config}] Force re-downloading...`);
      clearCache(config);
    } else {
      console.log(`[${config}] Downloading...`);
    }

    const startTime = Date.now();
    let lastPrint = 0;
    let lastLoaded = 0;

    try {
      const totalRows = await downloadDataset(config, (loaded, total) => {
        const now = Date.now();
        // Print progress every 500ms or on significant change
        if (now - lastPrint > 500 || loaded === total || loaded - lastLoaded >= 100) {
          const percent = Math.round((loaded / total) * 100);
          const bar = "█".repeat(Math.floor(percent / 5)) + "░".repeat(20 - Math.floor(percent / 5));
          const elapsed = ((now - startTime) / 1000).toFixed(0);
          process.stdout.write(`\r  [${bar}] ${percent}% (${loaded}/${total} rows) [${elapsed}s]   `);
          lastPrint = now;
          lastLoaded = loaded;
        }
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n  ✅ Downloaded ${totalRows} rows in ${elapsed}s`);
    } catch (error) {
      console.log(`\n  ❌ Failed: ${error}`);
      console.log("  Tip: Try again later or check your network connection.");
    }

    console.log();
  }

  console.log("Done!\n");
}

async function main(): Promise<void> {
  const config = parseConfig();

  if (config.clear) {
    console.log("\nClearing cache...");
    clearCache();
    console.log("Cache cleared.\n");
    return;
  }

  if (config.info) {
    await showInfo();
    return;
  }

  await downloadAll(config.configs, config.force);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
