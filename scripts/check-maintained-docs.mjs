import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const maintainedDocRoots = [
  "README.md",
  "CLAUDE.md",
  "AGENTS.md",
  "docs/index.md",
  "docs/start-here.md",
  "docs/quickstart.md",
  "docs/api",
  "docs/architecture",
  "docs/concepts",
  "docs/guide",
  "docs/guides",
  "docs/integration",
  "docs/mel",
  "docs/tutorial",
  "docs/internals/documentation-governance.md",
  "docs/internals/glossary.md",
  "docs/internals/index.md",
  "docs/internals/spec/current-contract.md",
  "docs/internals/test-conventions.md",
  "packages/codegen/docs/SPEC-v0.1.1.md",
  "packages/compiler/docs/SPEC-v1.2.0.md",
  "packages/core/docs/core-SPEC.md",
  "packages/governance/docs/governance-SPEC.md",
  "packages/host/docs/host-SPEC.md",
  "packages/lineage/docs/lineage-SPEC.md",
  "packages/sdk/docs/sdk-SPEC.md",
];

const excludedMaintainedPaths = new Set([
  "docs/guides/migrate-app-to-sdk.md",
  "docs/guides/performance-report.md",
  "docs/guides/typed-patch-ops.md",
]);

const packageMaintainedDocs = [
  "README.md",
  "docs/README.md",
  "docs/GUIDE.md",
];

const legacyApiPatterns = [
  { label: "createManifestoWorld", pattern: /\bcreateManifestoWorld\b/g },
  { label: "ManifestoWorld", pattern: /\bManifestoWorld\b/g },
  { label: "createMemoryWorldStore", pattern: /\bcreateMemoryWorldStore\b/g },
  { label: "WorldStore", pattern: /\bWorldStore\b/g },
];

const globalForbiddenPatterns = [
  ...legacyApiPatterns,
  { label: "@manifesto-ai/world/facade", pattern: /@manifesto-ai\/world\/facade/g },
  { label: "ManifestoConfig", pattern: /\bManifestoConfig\b/g },
  { label: "ManifestoInstance", pattern: /\bManifestoInstance\b/g },
  { label: "defineOps()", pattern: /\bdefineOps\(/g },
  { label: "createWorld()", pattern: /\bcreateWorld\(/g },
  { label: "await dispatch(", pattern: /await\s+dispatch\(/g },
  {
    label: "legacy dispatchAsync(action, input) signature",
    pattern: /dispatchAsync\(\s*[^,\n]+\s*,\s*["'`]/g,
  },
  {
    label: "top-level dispatchAsync(instance, intent) usage",
    pattern: /(?<!\.)dispatchAsync\(\s*[^),\n]+\s*,/g,
  },
  {
    label: "retired snapshot.data read",
    pattern: /\bsnapshot\.data\b/g,
  },
  {
    label: "retired HostContext boundary type",
    pattern: /\bHostContext\b/g,
  },
  {
    label: "retired three-input compute equation",
    pattern: /\bcompute(?:Sync)?\(\s*schema\s*,\s*snapshot\s*,\s*intent\s*\)/g,
  },
  {
    label: "retired compute equation wording",
    pattern: /compute\(schema, snapshot, intent\)/g,
  },
  {
    label: "retired compute snapshot tuple equation",
    pattern: /compute\(schema, snapshot[^\n)]*, intent, context\)\s*(?:->|→)\s*\(snapshot/g,
  },
  {
    label: "retired compute snapshot tuple return wording",
    pattern: /Returns:\s+\(snapshot'/g,
  },
  {
    label: "retired data.$ namespace wording",
    pattern: /\bdata\.\$\*/g,
  },
  {
    label: "retired missing once marker error",
    pattern: /Missing marker patch in once|Wrong marker in once|must have 'patch .* = \$runtime\.intent\.id'/g,
  },
  {
    label: "retired manual once marker wording",
    pattern: /Marker patch MUST be first|once\(\) has marker patch as FIRST statement|patch .*=\s*\$runtime\.intent\.id\s*\/\/\s*MUST/g,
  },
  {
    label: "retired SPEC-v1.3.0 reference",
    pattern: /\bSPEC-v1\.3\.0\b/g,
  },
  {
    label: "retired .mel.ts file extension",
    pattern: /\.mel\.ts\b/g,
  },
  {
    label: "bare result.ok submit success check",
    pattern: /if\s*\(\s*result\.ok\s*\)/g,
  },
  {
    label: "retired inline submit options bag",
    pattern: /\bsubmit\([^)\n]*\{\s*(?:context|diagnostics|report)\s*:/g,
  },
  {
    label: "retired inline preview options bag",
    pattern: /\bpreview\([^)\n]*\{\s*(?:context|diagnostics|report)\s*:/g,
  },
  {
    label: "retired $meta runtime namespace",
    pattern: /\$meta\./g,
  },
  {
    label: "retired $system runtime namespace",
    pattern: /\$system\./g,
  },
  {
    label: "retired $mel.sys runtime namespace",
    pattern: /\$mel\.sys\b/g,
  },
  {
    label: "retired SDK root getSnapshot read",
    pattern: /\b(?:app|instance|lineage|governed)\.getSnapshot\(/g,
  },
  {
    label: "retired SDK root getCanonicalSnapshot read",
    pattern: /\b(?:app|instance|lineage|governed|runtime)\.getCanonicalSnapshot\(/g,
  },
  {
    label: "retired SDK root subscribe call",
    pattern: /\b(?:app|instance|lineage|governed)\.subscribe\(/g,
  },
  {
    label: "retired SDK root createIntent call",
    pattern: /\b(?:app|instance|lineage|governed)\.createIntent\(/g,
  },
  {
    label: "retired SDK root dispatchAsync call",
    pattern: /\b(?:app|instance|lineage|governed)\.dispatchAsync(?:WithReport)?\(/g,
  },
  {
    label: "retired lineage root commitAsync call",
    pattern: /\blineage\.commitAsync(?:WithReport)?\(/g,
  },
  {
    label: "retired governance root proposeAsync call",
    pattern: /\bgoverned\.proposeAsync\(/g,
  },
  {
    label: "retired SDK actions namespace",
    pattern: /\b(?:app|runtime|lineage|governed|tenantApp)\.actions\./g,
  },
];

const docsSiteOnlyPatterns = [
  {
    label: "packages/ link from docs site page",
    pattern: /\]\(((\.\.\/)*|\/)?packages\//g,
  },
];

const filePatternExclusions = new Map([
  [
    "docs/internals/documentation-governance.md",
    new Set([
      "createManifestoWorld",
      "ManifestoWorld",
      "createMemoryWorldStore",
      "WorldStore",
      "retired snapshot.data read",
      "retired SDK root getSnapshot read",
      "retired SDK root subscribe call",
      "retired SDK root createIntent call",
      "retired SDK root dispatchAsync call",
      "retired lineage root commitAsync call",
      "retired governance root proposeAsync call",
      "retired HostContext boundary type",
      "retired three-input compute equation",
      "retired $meta runtime namespace",
      "retired $system runtime namespace",
      "retired $mel.sys runtime namespace",
    ]),
  ],
  [
    "docs/internals/spec/current-contract.md",
    new Set([
      "retired snapshot.data read",
      "retired SDK root getSnapshot read",
      "retired SDK root subscribe call",
      "retired SDK root createIntent call",
      "retired SDK root dispatchAsync call",
      "retired lineage root commitAsync call",
      "retired governance root proposeAsync call",
      "retired HostContext boundary type",
      "retired three-input compute equation",
      "retired $meta runtime namespace",
      "retired $system runtime namespace",
      "retired $mel.sys runtime namespace",
    ]),
  ],
]);

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectMarkdownFiles(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const stats = await fs.stat(absolutePath);

  if (stats.isFile()) {
    return relativePath.endsWith(".md") ? [relativePath] : [];
  }

  const entries = await fs.readdir(absolutePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "dist" || entry.name === "examples") {
      continue;
    }
    const childRelative = path.posix.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(childRelative));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(childRelative);
    }
  }
  return files;
}

async function collectMaintainedDocFiles() {
  const files = new Set();

  for (const root of maintainedDocRoots) {
    if (!(await pathExists(path.join(repoRoot, root)))) {
      continue;
    }
    for (const file of await collectMarkdownFiles(root)) {
      if (!excludedMaintainedPaths.has(file)) {
        files.add(file);
      }
    }
  }

  const packagesDir = path.join(repoRoot, "packages");
  const packageEntries = await fs.readdir(packagesDir, { withFileTypes: true });
  for (const entry of packageEntries) {
    if (!entry.isDirectory()) {
      continue;
    }
    for (const relativeDoc of packageMaintainedDocs) {
      const target = path.posix.join("packages", entry.name, relativeDoc);
      if (await pathExists(path.join(repoRoot, target))) {
        files.add(target);
      }
    }
  }

  return [...files].sort();
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

async function main() {
  const files = await collectMaintainedDocFiles();
  const failures = [];

  for (const file of files) {
    const absolute = path.join(repoRoot, file);
    const content = await fs.readFile(absolute, "utf8");
    const patterns = file.startsWith("docs/")
      ? [...globalForbiddenPatterns, ...docsSiteOnlyPatterns]
      : globalForbiddenPatterns;

    const excludedLabels = filePatternExclusions.get(file) ?? new Set();

    for (const { label, pattern } of patterns) {
      if (excludedLabels.has(label)) {
        continue;
      }
      const lines = collectMatches(content, pattern);
      if (lines.length > 0) {
        failures.push(`${file}: ${label} at line ${lines.join(", ")}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error("Maintained docs check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Maintained docs check passed (${files.length} files).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
