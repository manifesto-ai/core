import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkg = process.argv[2];

if (!pkg) {
  throw new Error("usage: node scripts/check-public-surface.mjs <package-path>");
}

const rules = {
  "packages/lineage": {
    allow: new Set([
      "ArtifactRef",
      "BranchId",
      "BranchInfo",
      "BranchSwitchResult",
      "CommitReport",
      "World",
      "WorldHead",
      "WorldId",
      "WorldLineage",
      "LineageConfig",
      "LineageCommitRuntime",
      "LineageInstance",
      "InMemoryLineageStore",
      "createInMemoryLineageStore",
      "withLineage",
    ]),
  },
  "packages/governance": {
    allow: new Set([
      "ActorAuthorityBinding",
      "ActorId",
      "ActorKind",
      "ActorRef",
      "AuthorityId",
      "AuthorityKind",
      "AuthorityPolicy",
      "AuthorityRef",
      "DecisionId",
      "DecisionRecord",
      "ErrorInfo",
      "FinalDecision",
      "GovernanceComposableManifesto",
      "GovernanceConfig",
      "GovernanceEvent",
      "GovernanceEventSink",
      "GovernanceEventType",
      "GovernanceExecutionConfig",
      "GovernanceInstance",
      "GovernanceProposalRuntime",
      "IntentScope",
      "PolicyCondition",
      "PolicyRule",
      "Proposal",
      "ProposalId",
      "ProposalSettlement",
      "ProposalSettlementReport",
      "ProposalStatus",
      "QuorumRule",
      "SourceKind",
      "SourceRef",
      "SupersedeReason",
      "Vote",
      "WaitingFor",
      "WaitForProposalOptions",
      "createInMemoryGovernanceStore",
      "createNoopGovernanceEventSink",
      "waitForProposal",
      "waitForProposalWithReport",
      "withGovernance",
    ]),
  },
};

const exportPath = process.argv[3];
const ruleKey = exportPath ? `${pkg}/${exportPath}` : pkg;
const rule = rules[ruleKey];
if (!rule) {
  throw new Error(`no public-surface rule configured for ${ruleKey}`);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const dtsPath = path.join(
  repoRoot,
  rule.dtsPath ?? path.join(pkg, "dist/index.d.ts"),
);
const source = readFileSync(dtsPath, "utf8");
const exportMatches = [...source.matchAll(/export(?:\s+type)?\s*\{([^}]+)\}/g)];
const exportedNames = new Set();

for (const match of exportMatches) {
  const block = match[1] ?? "";
  for (const rawPart of block.split(",")) {
    const part = rawPart.trim();
    if (!part) {
      continue;
    }

    const cleaned = part.replace(/^type\s+/, "");
    const aliasMatch = cleaned.match(/^(.+?)\s+as\s+(.+)$/);
    const exported = (aliasMatch ? aliasMatch[2] : cleaned).trim();
    exportedNames.add(exported);
  }
}

const unexpected = [...exportedNames]
  .filter((name) => !rule.allow.has(name))
  .sort();

if (unexpected.length > 0) {
  throw new Error(
    `${ruleKey} exports unexpected symbols: ${unexpected.join(", ")}`,
  );
}

const aliasMatches = [...source.matchAll(/\bas\s+([A-Za-z])\b/g)]
  .map((match) => match[1]);

if (aliasMatches.length > 0) {
  throw new Error(
    `${ruleKey} contains one-letter export aliases: ${aliasMatches.join(", ")}`,
  );
}
