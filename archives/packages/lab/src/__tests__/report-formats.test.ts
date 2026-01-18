/**
 * Report Formats Tests
 *
 * Tests for enhanced report format functionality (v1.1).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  enhanceReport,
  toMarkdown,
  toHTML,
  toReportJSON,
  toMarkdownFile,
  toHTMLFile,
} from "../report/formats.js";
import type {
  LabReport,
  LabTrace,
  LabTraceHeader,
  LabTraceEvent,
} from "../types.js";

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestReport(options: {
  outcome?: "success" | "failure" | "aborted";
  includeFailure?: boolean;
} = {}): LabReport {
  const header: LabTraceHeader = {
    specVersion: "lab/1.1",
    runId: "test-run-001",
    necessityLevel: 2,
    schemaHash: "test-hash",
    createdAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:01:00.000Z",
    durationMs: 60000,
  };

  const events: LabTraceEvent[] = [
    {
      type: "proposal",
      seq: 0,
      timestamp: "2024-01-01T00:00:10.000Z",
      proposalId: "p-1",
      intentType: "item.add",
      actorId: "test-actor",
    },
    {
      type: "authority.decision",
      seq: 1,
      timestamp: "2024-01-01T00:00:20.000Z",
      proposalId: "p-1",
      decision: options.outcome === "failure" ? "rejected" : "approved",
      authorityId: "test-authority",
    },
    {
      type: "apply",
      seq: 2,
      timestamp: "2024-01-01T00:00:30.000Z",
      intentId: "intent-1",
      patchCount: 3,
      source: "compute",
    },
    {
      type: "termination",
      seq: 3,
      timestamp: "2024-01-01T00:01:00.000Z",
      outcome: options.outcome === "failure" ? "failure" : "success",
    },
  ];

  const trace: LabTrace = {
    header,
    events,
    outcome: options.outcome ?? "success",
  };

  const report: LabReport = {
    runId: "test-run-001",
    necessityLevel: 2,
    startedAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:01:00.000Z",
    duration: 60000,
    outcome: options.outcome ?? "success",
    summary: {
      totalProposals: 1,
      approvedProposals: options.outcome === "failure" ? 0 : 1,
      rejectedProposals: options.outcome === "failure" ? 1 : 0,
      hitlInterventions: 0,
      totalPatches: 3,
      totalEffects: 0,
      worldsCreated: 0,
    },
    trace,
  };

  if (options.includeFailure) {
    report.failureExplanation = {
      kind: "informational" as const,
      title: "Goal Unreachable",
      description: "The goal cannot be reached from the current state",
      evidence: [],
      counterfactual: {
        change: {
          type: "state" as const,
          description: "Ensure precondition is satisfied",
        },
        expectedOutcome: "Goal would be reachable",
        confidence: 0.8,
      },
    };
  }

  return report;
}

// =============================================================================
// Test Suite
// =============================================================================

describe("enhanceReport", () => {
  it("adds format methods to report", () => {
    const report = createTestReport();
    const enhanced = enhanceReport(report);

    expect(typeof enhanced.toMarkdown).toBe("function");
    expect(typeof enhanced.toMarkdownFile).toBe("function");
    expect(typeof enhanced.toHTML).toBe("function");
    expect(typeof enhanced.toHTMLFile).toBe("function");
    expect(typeof enhanced.toJSON).toBe("function");
  });

  it("preserves original report data", () => {
    const report = createTestReport();
    const enhanced = enhanceReport(report);

    expect(enhanced.runId).toBe(report.runId);
    expect(enhanced.outcome).toBe(report.outcome);
    expect(enhanced.summary).toBe(report.summary);
  });
});

describe("toMarkdown", () => {
  it("generates markdown with header", () => {
    const report = createTestReport();
    const md = toMarkdown(report);

    expect(md).toContain("# Lab Report: test-run-001");
  });

  it("includes overview section", () => {
    const report = createTestReport();
    const md = toMarkdown(report);

    expect(md).toContain("## Overview");
    expect(md).toContain("Necessity Level");
    expect(md).toContain("2");
    expect(md).toContain("**success**");
  });

  it("includes summary section", () => {
    const report = createTestReport();
    const md = toMarkdown(report);

    expect(md).toContain("## Summary");
    expect(md).toContain("Total Proposals");
    expect(md).toContain("1");
  });

  it("includes failure analysis for failed reports", () => {
    const report = createTestReport({ outcome: "failure", includeFailure: true });
    const md = toMarkdown(report);

    expect(md).toContain("## Failure Analysis");
    expect(md).toContain("informational");
    expect(md).toContain("cannot be reached");
    expect(md).toContain("What Could Have Prevented This");
  });

  it("does not include failure section for successful reports", () => {
    const report = createTestReport({ outcome: "success" });
    const md = toMarkdown(report);

    expect(md).not.toContain("## Failure Analysis");
  });

  it("includes event timeline", () => {
    const report = createTestReport();
    const md = toMarkdown(report);

    expect(md).toContain("## Event Timeline");
    expect(md).toContain("proposal");
    expect(md).toContain("authority.decision");
  });
});

describe("toHTML", () => {
  it("generates valid HTML document", () => {
    const report = createTestReport();
    const html = toHTML(report);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("<title>Lab Report: test-run-001</title>");
  });

  it("includes CSS styles", () => {
    const report = createTestReport();
    const html = toHTML(report);

    expect(html).toContain("<style>");
    expect(html).toContain("</style>");
  });

  it("displays outcome badge with correct class", () => {
    const successReport = createTestReport({ outcome: "success" });
    const failureReport = createTestReport({ outcome: "failure" });

    const successHtml = toHTML(successReport);
    const failureHtml = toHTML(failureReport);

    expect(successHtml).toContain('class="outcome success"');
    expect(failureHtml).toContain('class="outcome failure"');
  });

  it("includes failure box for failed reports", () => {
    const report = createTestReport({ outcome: "failure", includeFailure: true });
    const html = toHTML(report);

    expect(html).toContain("Failure Analysis");
    expect(html).toContain('class="failure-box"');
    expect(html).toContain("informational");
  });

  it("escapes HTML special characters", () => {
    const report = createTestReport();
    report.runId = "<script>alert('xss')</script>";
    const html = toHTML(report);

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("toReportJSON", () => {
  it("generates structured JSON", () => {
    const report = createTestReport();
    const json = toReportJSON(report);

    expect(json.meta.runId).toBe("test-run-001");
    expect(json.meta.level).toBe(2);
    expect(json.meta.outcome).toBe("success");
  });

  it("includes summary counts", () => {
    const report = createTestReport();
    const json = toReportJSON(report);

    expect(json.summary.proposals).toBe(1);
    expect(json.summary.approvals).toBe(1);
    expect(json.summary.rejections).toBe(0);
  });

  it("includes failure info when present", () => {
    const report = createTestReport({ outcome: "failure", includeFailure: true });
    const json = toReportJSON(report);

    expect(json.failure).toBeDefined();
    expect(json.failure?.reason).toBe("GOAL_UNREACHABLE");
    expect(json.failure?.explanation).toContain("cannot be reached");
  });

  it("excludes failure when not present", () => {
    const report = createTestReport({ outcome: "success" });
    const json = toReportJSON(report);

    expect(json.failure).toBeUndefined();
  });

  it("includes timeline entries", () => {
    const report = createTestReport();
    const json = toReportJSON(report);

    expect(json.timeline.length).toBe(4);
    expect(json.timeline[0].event).toBe("proposal");
    expect(json.timeline[0].seq).toBe(0);
  });
});

describe("file output", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "lab-report-"));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("writes markdown to file", async () => {
    const report = createTestReport();
    const filePath = path.join(tempDir, "report.md");

    await toMarkdownFile(report, filePath);

    const content = await fs.promises.readFile(filePath, "utf-8");
    expect(content).toContain("# Lab Report");
  });

  it("writes HTML to file", async () => {
    const report = createTestReport();
    const filePath = path.join(tempDir, "report.html");

    await toHTMLFile(report, filePath);

    const content = await fs.promises.readFile(filePath, "utf-8");
    expect(content).toContain("<!DOCTYPE html>");
  });

  it("enhanced report file methods work", async () => {
    const report = createTestReport();
    const enhanced = enhanceReport(report);

    const mdPath = path.join(tempDir, "enhanced.md");
    const htmlPath = path.join(tempDir, "enhanced.html");

    await enhanced.toMarkdownFile(mdPath);
    await enhanced.toHTMLFile(htmlPath);

    const mdContent = await fs.promises.readFile(mdPath, "utf-8");
    const htmlContent = await fs.promises.readFile(htmlPath, "utf-8");

    expect(mdContent).toContain("# Lab Report");
    expect(htmlContent).toContain("<!DOCTYPE html>");
  });
});
