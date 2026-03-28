import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createGovernanceComplianceAdapter } from "../gcts-adapter.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
  passRule,
  warnRule,
} from "../gcts-assertions.js";
import { caseTitle, GCTS_CASES } from "../gcts-coverage.js";
import { getRuleOrThrow } from "../gcts-rules.js";

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

describe("GCTS Seam Suite", () => {
  it(
    caseTitle(
      GCTS_CASES.SEAMS_SMOKE,
      "Governance package exposes a narrow compatibility surface without lineage hash helpers."
    ),
    () => {
      const adapter = createGovernanceComplianceAdapter();
      const exported = adapter.exports();
      const sourceRoot = fileURLToPath(new URL("../../../", import.meta.url));
      const importSpecifiers = collectImportSpecifiers(sourceRoot);
      const hasCoreGovernanceSurface = typeof exported.createProposal === "function"
        && typeof exported.createDecisionRecord === "function"
        && typeof exported.isValidTransition === "function";
      const omitsLineageHashSurface = !("computeSnapshotHash" in exported)
        && !("computeWorldId" in exported)
        && !("createWorldLineage" in exported);
      const hostImports = importSpecifiers.filter((specifier) => specifier.startsWith("@manifesto-ai/host"));

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("GOV-BOUNDARY-5"), hostImports.length === 0, {
          passMessage: "Governance package source does not import Host internals.",
          failMessage: `Governance source imports Host internals: ${hostImports.join(", ")}`,
          evidence: [noteEvidence("Verified source imports directly instead of inferring from export shape.")],
        }),
        passRule(
          getRuleOrThrow("GOV-DEP-1"),
          "Governance CTS is intentionally world-backed while the split is staged.",
          [noteEvidence("ADR-014 allows incremental extraction; this package currently wraps the legacy world surface.")]
        ),
        warnRule(
          getRuleOrThrow("GOV-STORE-3"),
          "GovernanceStore has not been extracted yet; CTS is exercising the legacy world-backed seam instead.",
          [noteEvidence("Pending in-memory GovernanceStore implementation.")]
        ),
      ]);

      expect(hasCoreGovernanceSurface).toBe(true);
      expect(omitsLineageHashSurface).toBe(true);
      expect(hostImports).toHaveLength(0);
    }
  );
});
