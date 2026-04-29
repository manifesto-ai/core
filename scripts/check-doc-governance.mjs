import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const policyTargets = [
  {
    path: "docs/internals/documentation-governance.md",
    label: "documentation governance policy",
  },
  {
    path: "docs/internals/adr/index.md",
    label: "ADR index",
    expects: ["Implemented"],
  },
  {
    path: "docs/internals/spec/index.md",
    label: "SPEC index",
    expects: ["Living Document"],
  },
  {
    path: "docs-workflow-template.md",
    label: "workflow template",
    expects: ["Living SPEC"],
  },
  {
    path: "docs/internals/fdr/index.md",
    label: "FDR index",
    expects: ["inlined"],
  },
];

const statusExpectations = [
  {
    path: "docs/internals/spec/current-contract.md",
    status: "> **Status:** Living Document",
  },
  {
    path: "packages/core/docs/core-SPEC.md",
    status: "> **Status:** Normative (Living Document)",
  },
  {
    path: "packages/host/docs/host-SPEC.md",
    status: "> **Status:** Normative (Living Document)",
  },
  {
    path: "packages/sdk/docs/sdk-SPEC.md",
    status: "> **Status:** Normative (Living Document)",
  },
  {
    path: "packages/lineage/docs/lineage-SPEC.md",
    status: "> **Status:** Normative (Living Document)",
  },
  {
    path: "packages/governance/docs/governance-SPEC.md",
    status: "> **Status:** Normative (Living Document)",
  },
  {
    path: "packages/compiler/docs/SPEC-v1.2.0.md",
    status: "> **Status:** Normative",
  },
  {
    path: "packages/codegen/docs/SPEC-v0.1.1.md",
    status: "> **Status:** Normative Baseline",
  },
  {
    path: "packages/sdk/docs/FDR-v3.1.0.md",
    status: "> **Status:** Accepted Rationale Companion",
  },
  {
    path: "packages/compiler/docs/FDR-v0.5.0.md",
    status: "> **Status:** Accepted Rationale",
  },
];

const currentContractDocs = [
  "CLAUDE.md",
  "AGENTS.md",
  "docs/internals/spec/current-contract.md",
  "docs/internals/spec/index.md",
  "docs/internals/fdr/index.md",
  "docs/architecture/layers.md",
  "docs/concepts/world.md",
  "docs/api/runtime.md",
  "docs/api/sdk.md",
  "docs/api/lineage.md",
  "docs/api/governance.md",
  "docs/integration/ai-agents.md",
  "packages/sdk/docs/sdk-SPEC.md",
  "packages/sdk/docs/VERSION-INDEX.md",
  "packages/sdk/docs/FDR-v3.1.0.md",
  "packages/host/docs/host-SPEC.md",
  "packages/lineage/docs/lineage-SPEC.md",
  "packages/governance/docs/governance-SPEC.md",
  "packages/codegen/docs/SPEC-v0.1.1.md",
  "packages/codegen/docs/VERSION-INDEX.md",
  "packages/compiler/docs/VERSION-INDEX.md",
];

const forbiddenCurrentPatterns = [
  {
    label: "retired World Protocol terminology",
    pattern: /\bWorld Protocol\b/g,
  },
  {
    label: "retired World governs terminology",
    pattern: /\bWorld governs\b/g,
  },
  {
    label: "retired World governance terminology",
    pattern: /\bWorld governance\b/g,
  },
  {
    label: "retired World/App layer terminology",
    pattern: /\bWorld\/App\b/g,
  },
  {
    label: "retired world-anchored wording",
    pattern: /\bworld-anchored\b/g,
  },
  {
    label: "retired stored-world wording",
    pattern: /\bstored-world\b/g,
  },
  {
    label: "retired governed World path wording",
    pattern: /\bgoverned World path\b/g,
  },
  {
    label: "stale SDK FDR draft filename",
    pattern: /FDR-v3\.1\.0-draft(?:\.md)?/g,
  },
  {
    label: "draft status on current document",
    pattern: />\s*\*\*Status:\*\*\s*Draft\b/g,
  },
  {
    label: "draft rationale track on current document",
    pattern: /\bDraft Rationale Track\b|\bdraft rationale track\b/g,
  },
  {
    label: "current spec described as draft",
    pattern: /\bThis draft defines\b|\bv3 draft layers\b|\bv3\.1\.0 \(draft\)/g,
  },
];

const requiredAnchors = [
  {
    path: "docs/internals/spec/current-contract.md",
    tokens: [
      "ADR-026 v5 SDK Surface Baseline",
      "ActionHandle.submit(input)",
      "mode-specific result types",
      "snapshot.system.lastError",
      "namespaces.host.lastError",
      "MUST NOT automatically promote",
    ],
  },
  {
    path: "packages/sdk/docs/sdk-SPEC.md",
    tokens: [
      "### 18.1 Failure Observation Surfaces",
      "`snapshot.system.lastError` is the current semantic error surface",
      "`namespaces.host.lastError` is Host-owned execution diagnostic state",
      "getLastError()",
    ],
  },
  {
    path: "packages/host/docs/host-SPEC.md",
    tokens: [
      "`namespaces.host.lastError` is an execution diagnostic owned by Host",
      "MUST NOT be automatically promoted",
      "SDK/Lineage/Governance report helpers",
    ],
  },
  {
    path: "packages/lineage/docs/lineage-SPEC.md",
    tokens: [
      "Lineage v5 is the continuity-owning decorator",
      "actions.x.submit(...)",
      "WorldRecord",
      "Host-owned `namespaces.host.lastError` is a canonical-only",
      "MUST NOT | Lineage MUST NOT derive sealed failed outcome",
    ],
  },
  {
    path: "packages/governance/docs/governance-SPEC.md",
    tokens: [
      "Governance v5 is the legitimacy-owning decorator",
      "actions.x.submit(...)",
      "ProposalRef",
      "waitForSettlement(ref)",
      "type GovernanceSettlementReport",
      "`settled.before` MUST project",
      "MUST NOT | Governance `submit()` MUST NOT directly execute base or lineage write verbs",
      "MUST NOT | Governance settlement `ErrorInfo` MUST NOT merge",
    ],
  },
  {
    path: "docs/concepts/world.md",
    tokens: [
      "not a top-level package or governance layer",
      "Lineage-owned, immutable record",
      "withLineage()",
      "withGovernance()",
    ],
  },
];

const failures = [];

function readDoc(relativePath, label = relativePath) {
  try {
    return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  } catch {
    failures.push(`[missing] ${relativePath} (${label})`);
    return null;
  }
}

function collectMatches(content, pattern) {
  const matches = [];
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) {
      matches.push(index + 1);
    }
    pattern.lastIndex = 0;
  }
  return matches;
}

for (const target of policyTargets) {
  const content = readDoc(target.path, target.label);
  if (content == null) {
    continue;
  }
  for (const expected of target.expects ?? []) {
    if (!content.includes(expected)) {
      failures.push(
        `[missing token] ${target.label}: expected "${expected}" in ${target.path}`,
      );
    }
  }
}

for (const expectation of statusExpectations) {
  const content = readDoc(expectation.path);
  if (content != null && !content.includes(expectation.status)) {
    failures.push(`${expectation.path}: missing required status "${expectation.status}"`);
  }
}

for (const file of currentContractDocs) {
  const content = readDoc(file);
  if (content == null) {
    continue;
  }
  for (const { label, pattern } of forbiddenCurrentPatterns) {
    const lines = collectMatches(content, pattern);
    if (lines.length > 0) {
      failures.push(`${file}: ${label} at line ${lines.join(", ")}`);
    }
  }
}

for (const anchor of requiredAnchors) {
  const content = readDoc(anchor.path);
  if (content == null) {
    continue;
  }
  for (const token of anchor.tokens) {
    if (!content.includes(token)) {
      failures.push(`${anchor.path}: missing required anchor "${token}"`);
    }
  }
}

if (failures.length > 0) {
  console.error("Documentation governance check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Documentation governance check passed.");
