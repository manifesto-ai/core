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
  warnRule,
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

describe("LCTS Seam Suite", () => {
  const adapter = createLineageComplianceAdapter();

  it(
    caseTitle(
      LCTS_CASES.SEAMS_SURFACE,
      "Lineage package exposes lineage helpers without governance lifecycle/event exports."
    ),
    () => {
      const exported = adapter.exports();
      const sourceRoot = fileURLToPath(new URL("../../../", import.meta.url));
      const importSpecifiers = collectImportSpecifiers(sourceRoot);
      const hasLineageSurface = typeof exported.computeSnapshotHash === "function"
        && typeof exported.computeWorldId === "function"
        && typeof exported.createMemoryWorldStore === "function";
      const omitsGovernanceSurface = !("createProposal" in exported)
        && !("createDecisionRecord" in exported)
        && !("createNoopWorldEventSink" in exported)
        && !("ProposalQueue" in exported);
      const governanceImports = importSpecifiers.filter((specifier) => specifier.startsWith("@manifesto-ai/governance"));

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("LIN-BOUNDARY-1"), governanceImports.length === 0, {
          passMessage: "Lineage package source does not import @manifesto-ai/governance.",
          failMessage: `Lineage source imports governance package directly: ${governanceImports.join(", ")}`,
          evidence: [noteEvidence("Verified source imports directly instead of inferring from export shape.")],
        }),
        warnRule(
          getRuleOrThrow("LIN-BOUNDARY-4"),
          "Lineage public surface excludes governance/event helpers, but CTS still lacks direct runtime proof of non-emission.",
          [noteEvidence("Export-surface narrowing is partial evidence, not a full proof of non-emission.")],
        ),
      ]);

      expect(hasLineageSurface).toBe(true);
      expect(omitsGovernanceSurface).toBe(true);
      expect(governanceImports).toHaveLength(0);
    }
  );

  it(
    caseTitle(
      LCTS_CASES.STAGED_RULES,
      "Split-only lineage prepare/store rules remain visible as pending CTS entries."
    ),
    () => {
      const store = adapter.createMemoryStore() as { getWorld?: unknown };

      expectAllCompliance([
        warnRule(
          getRuleOrThrow("LIN-SEAL-PURE-1"),
          "Pure prepare/commit seams are still inside the monolithic world implementation.",
          [noteEvidence("Tracked ahead of LineageService extraction.")]
        ),
        warnRule(
          getRuleOrThrow("LIN-COLLISION-1"),
          "Explicit prepare-time collision contracts are not exposed through the compatibility adapter yet.",
          [noteEvidence("Tracked until prepareSealNext() exists in @manifesto-ai/lineage.")]
        ),
        warnRule(
          getRuleOrThrow("LIN-HEAD-ADV-1"),
          "Completed-only head advance remains an internal world invariant for now.",
          [noteEvidence("Tracked ahead of branch/head extraction.")]
        ),
        warnRule(
          getRuleOrThrow("LIN-STORE-3"),
          "Legacy createMemoryWorldStore() exists, but LineageStore has not been extracted as its own contract yet.",
          [noteEvidence(`Legacy store exposes getWorld=${typeof store.getWorld === "function"}.`)],
        ),
      ]);

      expect(typeof store.getWorld).toBe("function");
    }
  );
});
