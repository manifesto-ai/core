/**
 * Trace I/O Tests
 *
 * Tests for trace save/load functionality (v1.1).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  saveTrace,
  loadTrace,
  loadAllTraces,
  loadDirTraces,
  LabTraceIO,
} from "../trace/io.js";
import type { LabTrace, LabTraceHeader, LabTraceEvent } from "../types.js";

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestTrace(runId: string = "test-run"): LabTrace {
  const header: LabTraceHeader = {
    specVersion: "lab/1.1",
    runId,
    necessityLevel: 1,
    schemaHash: "test-schema-hash",
    createdAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:01:00.000Z",
    durationMs: 60000,
    environment: { test: true },
  };

  const events: LabTraceEvent[] = [
    {
      type: "proposal",
      seq: 0,
      timestamp: "2024-01-01T00:00:10.000Z",
      proposalId: "proposal-1",
      intentType: "test.action",
      actorId: "test-actor",
    },
    {
      type: "authority.decision",
      seq: 1,
      timestamp: "2024-01-01T00:00:20.000Z",
      proposalId: "proposal-1",
      decision: "approved",
      authorityId: "test-authority",
    },
    {
      type: "termination",
      seq: 2,
      timestamp: "2024-01-01T00:01:00.000Z",
      outcome: "success",
    },
  ];

  return {
    header,
    events,
    outcome: "success",
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe("TraceIO", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "lab-trace-io-"));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.promises.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("saveTrace / loadTrace (JSON)", () => {
    it("saves and loads trace as JSON", async () => {
      const trace = createTestTrace();
      const filePath = path.join(tempDir, "test.trace.json");

      await saveTrace(trace, filePath);
      const loaded = await loadTrace(filePath);

      expect(loaded.header.runId).toBe("test-run");
      expect(loaded.header.specVersion).toBe("lab/1.1");
      expect(loaded.events.length).toBe(3);
      expect(loaded.outcome).toBe("success");
    });

    it("saves with pretty option", async () => {
      const trace = createTestTrace();
      const filePath = path.join(tempDir, "test.trace.json");

      await saveTrace(trace, filePath, { pretty: true });
      const content = await fs.promises.readFile(filePath, "utf-8");

      // Pretty printed JSON has newlines
      expect(content).toContain("\n");
      expect(content).toContain("  ");
    });

    it("preserves all header fields", async () => {
      const trace = createTestTrace();
      const filePath = path.join(tempDir, "test.trace.json");

      await saveTrace(trace, filePath);
      const loaded = await loadTrace(filePath);

      expect(loaded.header.necessityLevel).toBe(1);
      expect(loaded.header.schemaHash).toBe("test-schema-hash");
      expect(loaded.header.createdAt).toBe("2024-01-01T00:00:00.000Z");
      expect(loaded.header.completedAt).toBe("2024-01-01T00:01:00.000Z");
      expect(loaded.header.durationMs).toBe(60000);
      expect(loaded.header.environment).toEqual({ test: true });
    });
  });

  describe("saveTrace / loadTrace (JSONL)", () => {
    it("saves and loads trace as JSONL", async () => {
      const trace = createTestTrace();
      const filePath = path.join(tempDir, "test.trace.jsonl");

      await saveTrace(trace, filePath, { format: "jsonl" });
      const loaded = await loadTrace(filePath);

      expect(loaded.header.runId).toBe("test-run");
      expect(loaded.events.length).toBe(3);
    });

    it("creates one line per event", async () => {
      const trace = createTestTrace();
      const filePath = path.join(tempDir, "test.trace.jsonl");

      await saveTrace(trace, filePath, { format: "jsonl" });
      const content = await fs.promises.readFile(filePath, "utf-8");
      const lines = content.trim().split("\n");

      // 1 header + 3 events = 4 lines
      expect(lines.length).toBe(4);
    });
  });

  describe("saveTrace / loadTrace (GZIP)", () => {
    it("saves and loads trace as gzipped JSON", async () => {
      const trace = createTestTrace();
      const filePath = path.join(tempDir, "test.trace.json.gz");

      await saveTrace(trace, filePath, { format: "json.gz" });
      const loaded = await loadTrace(filePath);

      expect(loaded.header.runId).toBe("test-run");
      expect(loaded.events.length).toBe(3);
    });

    it("creates compressed file", async () => {
      const trace = createTestTrace();
      const filePath = path.join(tempDir, "test.trace.json.gz");
      const jsonPath = path.join(tempDir, "test.trace.json");

      await saveTrace(trace, filePath, { format: "json.gz" });
      await saveTrace(trace, jsonPath, { format: "json" });

      const gzStats = await fs.promises.stat(filePath);
      const jsonStats = await fs.promises.stat(jsonPath);

      // Compressed file should be smaller
      expect(gzStats.size).toBeLessThan(jsonStats.size);
    });
  });

  describe("loadTrace validation", () => {
    it("throws on non-existent file", async () => {
      const filePath = path.join(tempDir, "non-existent.trace.json");

      await expect(loadTrace(filePath)).rejects.toThrow("Trace file not found");
    });

    it("throws on invalid JSON", async () => {
      const filePath = path.join(tempDir, "invalid.trace.json");
      await fs.promises.writeFile(filePath, "not valid json");

      await expect(loadTrace(filePath)).rejects.toThrow("Failed to parse");
    });

    it("throws on invalid trace structure", async () => {
      const filePath = path.join(tempDir, "invalid-structure.trace.json");
      await fs.promises.writeFile(filePath, JSON.stringify({ foo: "bar" }));

      await expect(loadTrace(filePath)).rejects.toThrow("Invalid trace file");
    });
  });

  describe("loadAllTraces", () => {
    it("loads all traces matching pattern", async () => {
      const trace1 = createTestTrace("run-001");
      const trace2 = createTestTrace("run-002");

      await saveTrace(trace1, path.join(tempDir, "run-001.trace.json"));
      await saveTrace(trace2, path.join(tempDir, "run-002.trace.json"));
      // Add a non-matching file
      await fs.promises.writeFile(path.join(tempDir, "other.txt"), "test");

      const traces = await loadAllTraces(path.join(tempDir, "*.trace.json"));

      expect(traces.length).toBe(2);
      expect(traces.map((t) => t.header.runId).sort()).toEqual([
        "run-001",
        "run-002",
      ]);
    });

    it("returns empty array for no matches", async () => {
      const traces = await loadAllTraces(path.join(tempDir, "*.trace.json"));

      expect(traces).toEqual([]);
    });

    it("returns empty array for non-existent directory", async () => {
      const traces = await loadAllTraces("/non-existent-dir/*.trace.json");

      expect(traces).toEqual([]);
    });
  });

  describe("loadDirTraces", () => {
    it("loads all trace files from directory", async () => {
      const trace1 = createTestTrace("run-001");
      const trace2 = createTestTrace("run-002");

      await saveTrace(trace1, path.join(tempDir, "run-001.trace.json"));
      await saveTrace(trace2, path.join(tempDir, "run-002.trace.jsonl"), {
        format: "jsonl",
      });

      const traces = await loadDirTraces(tempDir);

      expect(traces.length).toBe(2);
    });

    it("returns empty array for empty directory", async () => {
      const traces = await loadDirTraces(tempDir);

      expect(traces).toEqual([]);
    });

    it("returns empty array for non-existent directory", async () => {
      const traces = await loadDirTraces("/non-existent-dir");

      expect(traces).toEqual([]);
    });
  });

  describe("LabTraceIO namespace", () => {
    it("exposes all I/O functions", () => {
      expect(typeof LabTraceIO.load).toBe("function");
      expect(typeof LabTraceIO.loadAll).toBe("function");
      expect(typeof LabTraceIO.loadDir).toBe("function");
      expect(typeof LabTraceIO.save).toBe("function");
    });

    it("works via namespace", async () => {
      const trace = createTestTrace();
      const filePath = path.join(tempDir, "namespace.trace.json");

      await LabTraceIO.save(trace, filePath);
      const loaded = await LabTraceIO.load(filePath);

      expect(loaded.header.runId).toBe("test-run");
    });
  });

  describe("format detection", () => {
    it("detects JSON format from extension", async () => {
      const trace = createTestTrace();
      const filePath = path.join(tempDir, "auto.trace.json");

      await saveTrace(trace, filePath); // No format specified
      const content = await fs.promises.readFile(filePath, "utf-8");

      // Should be valid JSON
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it("detects GZIP format from extension", async () => {
      const trace = createTestTrace();
      const filePath = path.join(tempDir, "auto.trace.json.gz");

      await saveTrace(trace, filePath); // No format specified
      const loaded = await loadTrace(filePath);

      expect(loaded.header.runId).toBe("test-run");
    });
  });
});
