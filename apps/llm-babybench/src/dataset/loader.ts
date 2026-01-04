/**
 * @manifesto-ai/llm-babybench
 *
 * Dataset loader for HuggingFace LLM-BabyBench.
 *
 * Dataset: https://huggingface.co/datasets/salem-mbzuai/LLM-BabyBench
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { BabyBenchRow, DatasetConfig, DatasetLoadOptions, DatasetMetadata } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "../../.cache");

/**
 * HuggingFace dataset URL
 */
const DATASET_URL = "https://huggingface.co/datasets/salem-mbzuai/LLM-BabyBench";

/**
 * HuggingFace datasets API base URL
 */
const API_BASE = "https://datasets-server.huggingface.co";

/**
 * Ensure cache directory exists.
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Get cache file path for a config.
 */
function getCachePath(config: DatasetConfig): string {
  return path.join(CACHE_DIR, `${config}.json`);
}

/**
 * Load data from cache if available.
 */
function loadFromCache(config: DatasetConfig): BabyBenchRow[] | null {
  const cachePath = getCachePath(config);
  if (fs.existsSync(cachePath)) {
    try {
      const data = fs.readFileSync(cachePath, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Save data to cache.
 */
function saveToCache(config: DatasetConfig, data: BabyBenchRow[]): void {
  ensureCacheDir();
  const cachePath = getCachePath(config);
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a single page of data from HuggingFace with retry logic.
 */
async function fetchPage(
  config: DatasetConfig,
  offset: number,
  length: number,
  maxRetries = 5
): Promise<{ rows: BabyBenchRow[]; total: number }> {
  const url = `${API_BASE}/rows?dataset=salem-mbzuai/LLM-BabyBench&config=${config}&split=train&offset=${offset}&length=${length}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        // Retry on 5xx errors or rate limit (429)
        if ((response.status >= 500 || response.status === 429) && attempt < maxRetries - 1) {
          // Longer delay for rate limit
          const baseDelay = response.status === 429 ? 5000 : 1000;
          const delay = Math.pow(2, attempt) * baseDelay; // 5s, 10s, 20s for 429; 1s, 2s, 4s for 5xx
          await sleep(delay);
          continue;
        }
        throw new Error(`Failed to fetch dataset: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        rows: Array<{ row: BabyBenchRow }>;
        num_rows_total: number;
      };

      return {
        rows: data.rows.map((r) => r.row),
        total: data.num_rows_total,
      };
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error("Failed to fetch dataset after retries");
}

/**
 * Load dataset from HuggingFace.
 *
 * @param config - Dataset configuration ("decompose", "plan", or "predict")
 * @param options - Loading options
 * @returns Array of dataset rows
 */
export async function loadDataset(
  config: DatasetConfig,
  options: DatasetLoadOptions = {}
): Promise<BabyBenchRow[]> {
  const { limit, offset = 0, cache = true, levelName } = options;

  // Try cache first
  if (cache) {
    const cached = loadFromCache(config);
    if (cached) {
      let result = cached;

      // Apply filters
      if (levelName) {
        result = result.filter((r) => r.level_name === levelName);
      }

      // Apply offset and limit
      if (offset > 0 || limit !== undefined) {
        result = result.slice(offset, limit !== undefined ? offset + limit : undefined);
      }

      return result;
    }
  }

  // Fetch from HuggingFace
  const allRows: BabyBenchRow[] = [];
  const pageSize = 100;
  let currentOffset = offset;
  let total = Infinity;
  const targetCount = limit ?? Infinity;

  while (allRows.length < targetCount && currentOffset < total) {
    const fetchLength = Math.min(pageSize, targetCount - allRows.length);
    const { rows, total: totalRows } = await fetchPage(config, currentOffset, fetchLength);

    total = totalRows;
    allRows.push(...rows);
    currentOffset += rows.length;

    // If we got fewer rows than requested, we've reached the end
    if (rows.length < fetchLength) break;
  }

  // Cache the full result if no limit was specified
  if (cache && limit === undefined && offset === 0) {
    saveToCache(config, allRows);
  }

  // Apply level name filter
  let result = allRows;
  if (levelName) {
    result = result.filter((r) => r.level_name === levelName);
  }

  return result;
}

/**
 * Load a single row from the dataset.
 *
 * @param config - Dataset configuration
 * @param index - Row index
 * @returns Single dataset row
 */
export async function loadRow(
  config: DatasetConfig,
  index: number
): Promise<BabyBenchRow> {
  const { rows } = await fetchPage(config, index, 1);
  if (rows.length === 0) {
    throw new Error(`Row ${index} not found in ${config} dataset`);
  }
  return rows[0];
}

/**
 * Get dataset metadata.
 *
 * @param config - Dataset configuration
 * @returns Dataset metadata
 */
export async function getDatasetMetadata(config: DatasetConfig): Promise<DatasetMetadata> {
  const { total } = await fetchPage(config, 0, 1);

  // Get unique level names (sample first 100 rows)
  const { rows } = await fetchPage(config, 0, 100);
  const levelNames = [...new Set(rows.map((r) => r.level_name))].sort();

  return {
    totalRows: total,
    levelNames,
    version: new Date().toISOString().split("T")[0],
  };
}

/**
 * Clear the local cache.
 *
 * @param config - Optional config to clear, or all if not specified
 */
export function clearCache(config?: DatasetConfig): void {
  if (config) {
    const cachePath = getCachePath(config);
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
  } else {
    if (fs.existsSync(CACHE_DIR)) {
      fs.rmSync(CACHE_DIR, { recursive: true });
    }
  }
}

/**
 * Check if a config is cached.
 *
 * @param config - Dataset configuration
 * @returns True if cached
 */
export function isCached(config: DatasetConfig): boolean {
  return fs.existsSync(getCachePath(config));
}

/**
 * Download and cache the entire dataset for a config.
 *
 * @param config - Dataset configuration
 * @param onProgress - Progress callback
 * @returns Total rows downloaded
 */
export async function downloadDataset(
  config: DatasetConfig,
  onProgress?: (loaded: number, total: number) => void
): Promise<number> {
  const allRows: BabyBenchRow[] = [];
  const pageSize = 100;
  const requestDelay = 200; // 200ms between requests to avoid rate limiting
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const { rows, total: totalRows } = await fetchPage(config, offset, pageSize);
    total = totalRows;
    allRows.push(...rows);
    offset += rows.length;

    if (onProgress) {
      onProgress(allRows.length, total);
    }

    if (rows.length < pageSize) break;

    // Small delay between requests to avoid rate limiting
    await sleep(requestDelay);
  }

  saveToCache(config, allRows);
  return allRows.length;
}
