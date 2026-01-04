/**
 * Trace I/O
 *
 * Save and load Lab trace artifacts.
 * Added in v1.1.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { promisify } from "node:util";
const gunzip = promisify(zlib.gunzip);
const gzip = promisify(zlib.gzip);
/**
 * Detect trace format from file path.
 */
function detectFormat(filePath) {
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".json.gz"))
        return "json.gz";
    if (lower.endsWith(".jsonl"))
        return "jsonl";
    if (lower.endsWith(".json"))
        return "json";
    // Default to json
    return "json";
}
/**
 * Get file extension for format.
 */
function getExtension(format) {
    switch (format) {
        case "json":
            return ".trace.json";
        case "jsonl":
            return ".trace.jsonl";
        case "json.gz":
            return ".trace.json.gz";
    }
}
// =============================================================================
// Save
// =============================================================================
/**
 * Save a trace to a file.
 *
 * @param trace - The trace to save
 * @param filePath - Path to save to
 * @param options - Save options
 */
export async function saveTrace(trace, filePath, options = {}) {
    const format = options.format ?? detectFormat(filePath);
    const pretty = options.pretty ?? false;
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    switch (format) {
        case "json":
            await saveJsonTrace(trace, filePath, pretty);
            break;
        case "jsonl":
            await saveJsonlTrace(trace, filePath);
            break;
        case "json.gz":
            await saveGzipTrace(trace, filePath, pretty);
            break;
    }
}
async function saveJsonTrace(trace, filePath, pretty) {
    const content = pretty
        ? JSON.stringify(trace, null, 2)
        : JSON.stringify(trace);
    await fs.promises.writeFile(filePath, content, "utf-8");
}
async function saveJsonlTrace(trace, filePath) {
    const lines = [];
    // First line: header with metadata
    lines.push(JSON.stringify({
        _type: "header",
        ...trace.header,
        outcome: trace.outcome,
        failureExplanation: trace.failureExplanation,
    }));
    // Subsequent lines: events
    for (const event of trace.events) {
        lines.push(JSON.stringify(event));
    }
    const content = lines.join("\n") + "\n";
    await fs.promises.writeFile(filePath, content, "utf-8");
}
async function saveGzipTrace(trace, filePath, pretty) {
    const content = pretty
        ? JSON.stringify(trace, null, 2)
        : JSON.stringify(trace);
    const compressed = await gzip(Buffer.from(content, "utf-8"));
    await fs.promises.writeFile(filePath, compressed);
}
// =============================================================================
// Validation
// =============================================================================
/**
 * Basic validation for trace structure.
 */
function isValidTrace(data) {
    if (!data || typeof data !== "object")
        return false;
    const obj = data;
    // Must have header object
    if (!obj.header || typeof obj.header !== "object")
        return false;
    const header = obj.header;
    // Header must have required fields
    if (typeof header.specVersion !== "string")
        return false;
    if (typeof header.runId !== "string")
        return false;
    if (typeof header.necessityLevel !== "number")
        return false;
    if (typeof header.schemaHash !== "string")
        return false;
    if (typeof header.createdAt !== "string")
        return false;
    // Must have events array
    if (!Array.isArray(obj.events))
        return false;
    // Each event must have type, seq, timestamp
    for (const event of obj.events) {
        if (!event || typeof event !== "object")
            return false;
        const e = event;
        if (typeof e.type !== "string")
            return false;
        if (typeof e.seq !== "number")
            return false;
        if (typeof e.timestamp !== "string")
            return false;
    }
    return true;
}
// =============================================================================
// Load
// =============================================================================
/**
 * Load a trace from a file.
 *
 * @param filePath - Path to the trace file
 * @returns The loaded trace
 * @throws Error if file is invalid or corrupted
 */
export async function loadTrace(filePath) {
    const format = detectFormat(filePath);
    // Check file exists
    try {
        await fs.promises.access(filePath, fs.constants.R_OK);
    }
    catch {
        throw new Error(`Trace file not found: ${filePath}`);
    }
    let trace;
    switch (format) {
        case "json":
            trace = await loadJsonTrace(filePath);
            break;
        case "jsonl":
            trace = await loadJsonlTrace(filePath);
            break;
        case "json.gz":
            trace = await loadGzipTrace(filePath);
            break;
    }
    // Basic validation
    if (!isValidTrace(trace)) {
        throw new Error(`Invalid trace file: ${filePath}`);
    }
    return trace;
}
async function loadJsonTrace(filePath) {
    const content = await fs.promises.readFile(filePath, "utf-8");
    try {
        return JSON.parse(content);
    }
    catch (error) {
        throw new Error(`Failed to parse JSON trace: ${filePath}`);
    }
}
async function loadJsonlTrace(filePath) {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");
    if (lines.length === 0) {
        throw new Error(`Empty trace file: ${filePath}`);
    }
    try {
        // First line is header with metadata
        const headerLine = JSON.parse(lines[0]);
        const { _type, outcome, failureExplanation, ...header } = headerLine;
        // Rest are events
        const events = lines.slice(1).map((line) => JSON.parse(line));
        return {
            header,
            events,
            outcome,
            failureExplanation,
        };
    }
    catch (error) {
        throw new Error(`Failed to parse JSONL trace: ${filePath}`);
    }
}
async function loadGzipTrace(filePath) {
    const compressed = await fs.promises.readFile(filePath);
    try {
        const decompressed = await gunzip(compressed);
        return JSON.parse(decompressed.toString("utf-8"));
    }
    catch (error) {
        throw new Error(`Failed to decompress/parse gzip trace: ${filePath}`);
    }
}
// =============================================================================
// Load Multiple
// =============================================================================
/**
 * Load multiple traces matching a glob pattern.
 *
 * @param pattern - Glob pattern (e.g., "./traces/*.trace.json")
 * @returns Array of loaded traces
 */
export async function loadAllTraces(pattern) {
    // Simple glob implementation for common patterns
    const dir = path.dirname(pattern);
    const filePattern = path.basename(pattern);
    // Check if directory exists
    try {
        await fs.promises.access(dir, fs.constants.R_OK);
    }
    catch {
        return [];
    }
    const files = await fs.promises.readdir(dir);
    const matchingFiles = files.filter((file) => matchGlob(file, filePattern));
    const traces = [];
    for (const file of matchingFiles) {
        try {
            const trace = await loadTrace(path.join(dir, file));
            traces.push(trace);
        }
        catch (error) {
            // Skip invalid traces, log warning
            console.warn(`[TraceIO] Skipping invalid trace: ${file}`, error);
        }
    }
    return traces;
}
/**
 * Load all traces from a directory.
 *
 * @param dir - Directory path
 * @returns Array of loaded traces
 */
export async function loadDirTraces(dir) {
    // Check if directory exists
    try {
        await fs.promises.access(dir, fs.constants.R_OK);
    }
    catch {
        return [];
    }
    const files = await fs.promises.readdir(dir);
    const traceFiles = files.filter((file) => file.endsWith(".trace.json") ||
        file.endsWith(".trace.jsonl") ||
        file.endsWith(".trace.json.gz") ||
        file.endsWith(".lab.trace.json") ||
        file.endsWith(".lab.trace.jsonl") ||
        file.endsWith(".lab.trace.json.gz"));
    const traces = [];
    for (const file of traceFiles) {
        try {
            const trace = await loadTrace(path.join(dir, file));
            traces.push(trace);
        }
        catch (error) {
            // Skip invalid traces, log warning
            console.warn(`[TraceIO] Skipping invalid trace: ${file}`, error);
        }
    }
    return traces;
}
// =============================================================================
// Helpers
// =============================================================================
/**
 * Simple glob matcher for common patterns.
 * Supports: *, ?.
 */
function matchGlob(filename, pattern) {
    const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
        .replace(/\*/g, ".*") // * -> .*
        .replace(/\?/g, "."); // ? -> .
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filename);
}
// =============================================================================
// LabTrace Namespace (Static Methods)
// =============================================================================
/**
 * LabTrace static methods for I/O operations.
 */
export const LabTraceIO = {
    /**
     * Load a single trace from file.
     */
    load: loadTrace,
    /**
     * Load multiple traces matching glob pattern.
     */
    loadAll: loadAllTraces,
    /**
     * Load all traces from directory.
     */
    loadDir: loadDirTraces,
    /**
     * Save a trace to file.
     */
    save: saveTrace,
};
//# sourceMappingURL=io.js.map