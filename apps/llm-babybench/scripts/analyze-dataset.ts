#!/usr/bin/env npx tsx
/**
 * Analyze dataset levels and statistics
 */

import { loadDataset } from "../src/dataset/index.js";
import type { DatasetConfig } from "../src/dataset/types.js";

async function main() {
  console.log("\n=== LLM-BabyBench Dataset Analysis ===\n");

  const configs: DatasetConfig[] = ["predict", "plan", "decompose"];

  for (const config of configs) {
    console.log(`[${config}]`);
    const rows = await loadDataset(config);

    // Count by level
    const levelCounts = new Map<string, number>();
    for (const row of rows) {
      const count = levelCounts.get(row.level_name) || 0;
      levelCounts.set(row.level_name, count + 1);
    }

    // Sort by count
    const sorted = [...levelCounts.entries()].sort((a, b) => b[1] - a[1]);

    console.log(`  Total: ${rows.length} rows`);
    console.log(`  Levels:`);
    for (const [level, count] of sorted) {
      console.log(`    - ${level}: ${count}`);
    }
    console.log();
  }
}

main().catch(console.error);
