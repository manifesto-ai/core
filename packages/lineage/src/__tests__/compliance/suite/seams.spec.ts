import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createLineageComplianceAdapter } from "../lcts-adapter.js";
import { caseTitle, LCTS_CASES } from "../lcts-coverage.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
} from "../lcts-assertions.js";
import { getRuleOrThrow } from "../lcts-rules.js";

function collectImportSpecifiers(root: string): string[] {
  const collected: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "__tests__") {
      continue;
    }

    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectImportSpecifiers(fullPath));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }

    const source = readFileSync(fullPath, "utf8");
    for (const match of source.matchAll(/from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g)) {
      const specifier = match[1] ?? match[2];
      if (specifier) {
        collected.push(specifier);
      }
    }
  }

  return collected;
}

function collectSourceContents(root: string): string[] {
  const sources: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "__tests__") {
      continue;
    }

    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      sources.push(...collectSourceContents(fullPath));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }

    sources.push(readFileSync(fullPath, "utf8"));
  }

  return sources;
}

describe("LCTS Seam Suite", () => {
  const adapter = createLineageComplianceAdapter();

  it(
    caseTitle(
      LCTS_CASES.SEAMS_SURFACE,
      "Lineage stays governance-free and exposes branch-plus-attempt store seams."
    ),
    () => {
      const exported = adapter.exports();
      const store = adapter.createMemoryStore();
      const sourceRoot = fileURLToPath(new URL("../../../", import.meta.url));
      const importSpecifiers = collectImportSpecifiers(sourceRoot);
      const sourceContents = collectSourceContents(sourceRoot);
      const hasLineageSurface = typeof exported.computeSnapshotHash === "function"
        && typeof exported.computeWorldId === "function"
        && typeof exported.createInMemoryLineageStore === "function"
        && typeof exported.createLineageService === "function";
      const omitsGovernanceSurface = !("createProposal" in exported)
        && !("createDecisionRecord" in exported)
        && !("createNoopWorldEventSink" in exported)
        && !("ProposalQueue" in exported);
      const governanceImports = importSpecifiers.filter((specifier) => specifier.startsWith("@manifesto-ai/governance"));
      const eventImports = importSpecifiers.filter((specifier) =>
        specifier === "events"
        || specifier === "node:events"
        || specifier.includes("/events")
      );
      const eventEmissionSites = sourceContents.reduce((count, source) => {
        return count
          + [...source.matchAll(/\.emit\(/g)].length
          + [...source.matchAll(/dispatchEvent\(/g)].length
          + [...source.matchAll(/new\s+EventTarget\(/g)].length;
      }, 0);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("LIN-BOUNDARY-1"), governanceImports.length === 0, {
          passMessage: "Lineage package source does not import @manifesto-ai/governance.",
          failMessage: `Lineage source imports governance package directly: ${governanceImports.join(", ")}`,
          evidence: [noteEvidence("Verified source imports directly instead of inferring from export shape.")],
        }),
        evaluateRule(getRuleOrThrow("LIN-BOUNDARY-4"), eventImports.length === 0 && eventEmissionSites === 0, {
          passMessage: "Lineage source does not import event infrastructure or emit events.",
          failMessage: `Lineage source shows event usage (imports=${eventImports.join(", ") || "none"}, emissionSites=${eventEmissionSites}).`,
          evidence: [noteEvidence("Scanned source imports and common event-emission primitives to verify event-free lineage ownership.")],
        }),
        evaluateRule(getRuleOrThrow("LIN-STORE-3"), typeof store.getWorld === "function"
          && typeof store.getSnapshot === "function"
          && typeof store.getAttempts === "function"
          && typeof store.getAttemptsByBranch === "function"
          && typeof store.getBranchTip === "function"
          && typeof store.commitPrepared === "function", {
          passMessage: "Lineage package provides an in-memory store with branch and attempt query seams.",
          failMessage: "In-memory LineageStore implementation is missing branch/tip/attempt capabilities.",
          evidence: [noteEvidence("Verified core store methods on createInMemoryLineageStore().")],
        }),
      ]);

      expect(hasLineageSurface).toBe(true);
      expect(omitsGovernanceSurface).toBe(true);
      expect(governanceImports).toHaveLength(0);
      expect(eventImports).toHaveLength(0);
      expect(eventEmissionSites).toBe(0);
    }
  );
});
