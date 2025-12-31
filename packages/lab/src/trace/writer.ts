/**
 * Trace File Writer
 *
 * Writes Lab traces to files in various formats.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { promisify } from "node:util";
import type { LabTrace } from "../types.js";
import type { TraceWriterOptions } from "./types.js";

const gzip = promisify(zlib.gzip);

/**
 * Get the trace file path based on options.
 */
export function getTraceFilePath(options: TraceWriterOptions): string {
  const extension = getExtension(options.format);
  const filename = `${options.runId}.lab.trace${extension}`;
  return path.join(options.outputPath, filename);
}

/**
 * Get file extension for format.
 */
function getExtension(format: "json" | "jsonl" | "json.gz"): string {
  switch (format) {
    case "json":
      return ".json";
    case "jsonl":
      return ".jsonl";
    case "json.gz":
      return ".json.gz";
  }
}

/**
 * Write trace to file.
 */
export async function writeTrace(
  trace: LabTrace,
  options: TraceWriterOptions
): Promise<string> {
  // Ensure output directory exists
  await fs.promises.mkdir(options.outputPath, { recursive: true });

  const filePath = getTraceFilePath(options);

  switch (options.format) {
    case "json":
      await writeJsonTrace(trace, filePath);
      break;
    case "jsonl":
      await writeJsonlTrace(trace, filePath);
      break;
    case "json.gz":
      await writeGzipTrace(trace, filePath);
      break;
  }

  return filePath;
}

/**
 * Write trace as single JSON file.
 */
async function writeJsonTrace(trace: LabTrace, filePath: string): Promise<void> {
  const content = JSON.stringify(trace, null, 2);
  await fs.promises.writeFile(filePath, content, "utf-8");
}

/**
 * Write trace as JSON Lines file.
 * First line is header, subsequent lines are events.
 */
async function writeJsonlTrace(trace: LabTrace, filePath: string): Promise<void> {
  const lines = [
    JSON.stringify(trace.header),
    ...trace.events.map((event) => JSON.stringify(event)),
  ];
  const content = lines.join("\n") + "\n";
  await fs.promises.writeFile(filePath, content, "utf-8");
}

/**
 * Write trace as gzipped JSON file.
 */
async function writeGzipTrace(trace: LabTrace, filePath: string): Promise<void> {
  const content = JSON.stringify(trace, null, 2);
  const compressed = await gzip(Buffer.from(content, "utf-8"));
  await fs.promises.writeFile(filePath, compressed);
}
