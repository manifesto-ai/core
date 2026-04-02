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
      GCTS_CASES.SEAMS_NATIVE_SURFACE,
      "Governance package exposes native store/service exports through the provider entry point without world or host internals."
    ),
    async () => {
      const adapter = createGovernanceComplianceAdapter();
      const exported = adapter.exports();
      const store = adapter.createStore();
      const sourceRoot = fileURLToPath(new URL("../../../", import.meta.url));
      const importSpecifiers = collectImportSpecifiers(sourceRoot);
      const hostImports = importSpecifiers.filter((specifier) => specifier.startsWith("@manifesto-ai/host"));
      const worldImports = importSpecifiers.filter((specifier) => specifier.startsWith("@manifesto-ai/world"));
      const hasNativeSurface = typeof exported.createInMemoryGovernanceStore === "function"
        && typeof exported.createGovernanceService === "function"
        && typeof exported.createAuthorityEvaluator === "function";
      const omitsExecutionOwnership = (exported as Record<string, unknown>).HostExecutor === undefined
        && (exported as Record<string, unknown>).HostExecutionOptions === undefined
        && (exported as Record<string, unknown>).HostExecutionResult === undefined;
      const executionStageStoreWorks = await (async () => {
        await store.putProposal({
          proposalId: "p-1",
          baseWorld: "world-1",
          branchId: "branch-1",
          actorId: "actor-1",
          authorityId: "auth-1",
          intent: { type: "demo", intentId: "intent-1" },
          status: "approved",
          executionKey: "p-1:1",
          submittedAt: 1,
          decidedAt: 2,
          decisionId: "dec-1",
          epoch: 0,
        });
        return (await store.getExecutionStageProposal("branch-1"))?.proposalId === "p-1";
      })();

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("GOV-BOUNDARY-5"), hostImports.length === 0 && worldImports.length === 0, {
          passMessage: "Governance package source imports neither Host nor World internals.",
          failMessage: `Governance source imports forbidden packages: ${[...hostImports, ...worldImports].join(", ")}`,
          evidence: [noteEvidence("Scanned source import graph directly.")],
        }),
        passRule(
          getRuleOrThrow("GOV-DEP-1"),
          "Governance split now depends only on lineage/core-facing public contracts.",
          [noteEvidence("The package exports native service/store/authority surfaces and no longer wraps @manifesto-ai/world.")]
        ),
        evaluateRule(getRuleOrThrow("GOV-STORE-3"), typeof exported.createInMemoryGovernanceStore === "function", {
          passMessage: "Governance package provides a native in-memory GovernanceStore implementation.",
          failMessage: "Governance package is missing native in-memory GovernanceStore implementation.",
          evidence: [noteEvidence("Verified createInMemoryGovernanceStore() exists on the governance provider entry point.")],
        }),
        evaluateRule(getRuleOrThrow("GOV-STORE-4"), executionStageStoreWorks, {
          passMessage: "GovernanceStore.getExecutionStageProposal() returns the single approved/executing proposal for a branch.",
          failMessage: "GovernanceStore.getExecutionStageProposal() did not return the execution-stage branch occupant.",
          evidence: [noteEvidence("Stored an approved proposal and retrieved it through getExecutionStageProposal().")],
        }),
      ]);

      expect(hasNativeSurface).toBe(true);
      expect(executionStageStoreWorks).toBe(true);
      expect(omitsExecutionOwnership).toBe(true);
      expect(hostImports).toHaveLength(0);
      expect(worldImports).toHaveLength(0);
    }
  );
});
