import fs from "node:fs";

const targets = [
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

const failures = [];

for (const target of targets) {
  const content = fs.readFileSync(target.path, "utf8");
  if (!content) {
    failures.push(`[missing] ${target.path} (${target.label})`);
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

if (failures.length > 0) {
  console.error("Documentation governance check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Documentation governance check passed.");
