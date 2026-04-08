import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const defaultOutDir = path.join(repoRoot, "temp", "canonical-docs");
const execFileAsync = promisify(execFile);
const CURRENT_CONTRACT_DOC = "docs/internals/spec/current-contract.md";

const CONSTITUTION_AND_GOVERNANCE = [
  "CLAUDE.md",
  "docs/internals/documentation-governance.md",
  "docs/internals/adr/index.md",
  "docs/internals/fdr/index.md",
];

const API_AND_GLOSSARY_PREFIX = [
  "docs/internals/glossary.md",
];

function parseArgs(argv) {
  let outDir = defaultOutDir;
  let listOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--list") {
      listOnly = true;
      continue;
    }

    if (arg === "--out-dir") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--out-dir requires a value");
      }
      outDir = path.resolve(repoRoot, value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { outDir, listOnly };
}

async function pathExists(relativePath) {
  try {
    await fs.access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

async function collectFilesUnder(relativeDir, extensions) {
  const files = [];

  async function walk(dir) {
    const entries = await fs.readdir(path.join(repoRoot, dir), { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(relativePath);
        continue;
      }

      const extension = path.posix.extname(entry.name);
      if (extensions.includes(extension)) {
        files.push(relativePath);
      }
    }
  }

  await walk(relativeDir);
  return uniqueSorted(files);
}

function extractCurrentSpecPaths(specIndexContent) {
  const start = specIndexContent.indexOf("## Current Normative Package Specifications");
  const end = specIndexContent.indexOf("## Historical and Removed References");
  const section = start >= 0 && end > start
    ? specIndexContent.slice(start, end)
    : specIndexContent;

  const paths = new Set();
  const githubBlobPattern = /https:\/\/github\.com\/manifesto-ai\/core\/blob\/main\/([^)#\s]+\.md)/g;

  for (const match of section.matchAll(githubBlobPattern)) {
    const relativePath = match[1];
    if (
      relativePath?.startsWith("packages/")
      && !relativePath.endsWith("VERSION-INDEX.md")
    ) {
      paths.add(relativePath);
    }
  }

  return [...paths];
}

function extractCurrentVersionIndexDocPaths(versionIndexContent, versionIndexPath) {
  const stopHeadings = [
    "## Archived Versions",
    "## All Versions",
    "## Reading Order",
    "## Reading Guide",
  ];

  let currentSection = versionIndexContent;
  for (const heading of stopHeadings) {
    const index = currentSection.indexOf(heading);
    if (index >= 0) {
      currentSection = currentSection.slice(0, index);
    }
  }

  const linkPattern = /\]\(([^)#\s]+\.md)\)/g;
  const currentDir = path.posix.dirname(versionIndexPath);
  const paths = new Set();

  for (const match of currentSection.matchAll(linkPattern)) {
    const target = match[1];
    if (!target || target.startsWith("http")) {
      continue;
    }

    const resolved = path.posix.normalize(path.posix.join(currentDir, target));
    if (!resolved.startsWith("packages/")) {
      continue;
    }
    if (resolved.endsWith("VERSION-INDEX.md")) {
      continue;
    }
    if (path.posix.basename(resolved).startsWith("FDR-")) {
      continue;
    }

    paths.add(resolved);
  }

  return [...paths];
}

function packageRootOf(relativePath) {
  const [packagesDir, packageName] = relativePath.split("/");
  return packagesDir === "packages" && packageName
    ? path.posix.join(packagesDir, packageName)
    : null;
}

async function collectCurrentPackageDocs() {
  const specIndexPath = "docs/internals/spec/index.md";
  const specIndexContent = await fs.readFile(path.join(repoRoot, specIndexPath), "utf8");
  const currentSpecPaths = extractCurrentSpecPaths(specIndexContent);
  const packageRoots = uniqueSorted(
    currentSpecPaths
      .map(packageRootOf)
      .filter((value) => value !== null),
  );

  const files = new Set([
    "README.md",
  ]);

  for (const root of packageRoots) {
    const versionIndexPath = path.posix.join(root, "docs", "VERSION-INDEX.md");
    const candidates = [
      path.posix.join(root, "README.md"),
      path.posix.join(root, "docs", "README.md"),
      path.posix.join(root, "docs", "GUIDE.md"),
    ];

    for (const candidate of candidates) {
      if (await pathExists(candidate)) {
        files.add(candidate);
      }
    }

    if (await pathExists(versionIndexPath)) {
      const versionIndexContent = await fs.readFile(
        path.join(repoRoot, versionIndexPath),
        "utf8",
      );

      for (const currentDoc of extractCurrentVersionIndexDocPaths(
        versionIndexContent,
        versionIndexPath,
      )) {
        if (currentDoc.startsWith(root) && await pathExists(currentDoc)) {
          files.add(currentDoc);
        }
      }
    }
  }

  for (const specPath of currentSpecPaths) {
    if (await pathExists(specPath)) {
      files.add(specPath);
    }
  }

  return uniqueSorted(files);
}

async function collectAdrFiles() {
  const adrIndexPath = "docs/internals/adr/index.md";
  const content = await fs.readFile(path.join(repoRoot, adrIndexPath), "utf8");
  const start = content.indexOf("## Global ADRs");
  const end = content.indexOf("### ADR-006 Companion Evidence");
  const section = start >= 0 && end > start
    ? content.slice(start, end)
    : content;
  const linkPattern = /\]\(\.\/([^)#\s]+)\)/g;
  const adrs = [];

  for (const match of section.matchAll(linkPattern)) {
    const rawTarget = match[1];
    const target = rawTarget?.endsWith(".md") ? rawTarget : `${rawTarget}.md`;
    if (!target || !/^\d{3}[a-z]?-.+\.md$/.test(target)) {
      continue;
    }
    adrs.push(path.posix.join("docs/internals/adr", target));
  }

  return uniqueSorted([
    adrIndexPath,
    ...adrs,
  ]);
}

async function collectApiAndGlossaryDocs() {
  const apiDocs = await collectFilesUnder("docs/api", [".md"]);
  return uniqueSorted([
    ...API_AND_GLOSSARY_PREFIX,
    ...apiDocs,
  ]);
}

async function collectMelDocs() {
  return collectFilesUnder("docs/mel", [".md", ".mel"]);
}

async function collectArchitectureDocs() {
  return collectFilesUnder("docs/architecture", [".md"]);
}

async function buildBundles() {
  const currentPackageDocs = await collectCurrentPackageDocs();
  const adrDocs = await collectAdrFiles();
  const apiAndGlossaryDocs = await collectApiAndGlossaryDocs();
  const architectureDocs = await collectArchitectureDocs();
  const melDocs = await collectMelDocs();

  return [
    {
      id: "current-contract",
      filename: "00-current-contract.md",
      title: "Current Contract",
      files: [CURRENT_CONTRACT_DOC],
    },
    {
      id: "constitution-and-governance",
      filename: "05-constitution-and-governance.md",
      title: "Constitution and Governance",
      files: uniqueSorted(CONSTITUTION_AND_GOVERNANCE),
    },
    {
      id: "current-package-docs",
      filename: "10-current-package-docs.md",
      title: "Current Package Docs",
      files: currentPackageDocs,
    },
    {
      id: "active-adrs",
      filename: "20-active-adrs.md",
      title: "Active ADRs",
      files: adrDocs,
    },
    {
      id: "api-and-glossary",
      filename: "30-api-and-glossary.md",
      title: "API and Glossary",
      files: apiAndGlossaryDocs,
    },
    {
      id: "architecture",
      filename: "40-architecture.md",
      title: "Architecture",
      files: architectureDocs,
    },
    {
      id: "mel-language",
      filename: "50-mel-language.md",
      title: "MEL Language",
      files: melDocs,
    },
  ];
}

async function renderBundle(bundle, generatedAt) {
  const sections = [];

  for (const file of bundle.files) {
    const content = await fs.readFile(path.join(repoRoot, file), "utf8");
    sections.push([
      `## Source: \`${file}\``,
      "",
      content.trimEnd(),
    ].join("\n"));
  }

  return [
    `# Canonical Docs Bundle: ${bundle.title}`,
    "",
    `Generated: ${generatedAt}`,
    "",
    "Sources:",
    ...bundle.files.map((file) => `- ${file}`),
    "",
    "---",
    "",
    sections.join("\n\n---\n\n"),
    "",
  ].join("\n");
}

function printBundleList(bundles) {
  for (const bundle of bundles) {
    console.log(`[${bundle.id}] ${bundle.filename}`);
    for (const file of bundle.files) {
      console.log(`- ${file}`);
    }
    console.log("");
  }
}

async function createTarGz(archivePath, baseDir, entries) {
  await fs.mkdir(path.dirname(archivePath), { recursive: true });
  await execFileAsync("tar", ["-czf", archivePath, "-C", baseDir, ...entries]);
}

async function writeOutputs(outDir, bundles) {
  const generatedAt = new Date().toISOString();
  await fs.mkdir(outDir, { recursive: true });
  await fs.rm(path.join(outDir, "archives"), { recursive: true, force: true });
  const generatedFiles = bundles.map((bundle) => bundle.filename);

  const manifest = {
    generatedAt,
    repoRoot,
    outDir,
    bundles: bundles.map((bundle) => ({
      id: bundle.id,
      title: bundle.title,
      filename: bundle.filename,
      sourceCount: bundle.files.length,
      sources: bundle.files,
    })),
    sourceFileCount: bundles.reduce((count, bundle) => count + bundle.files.length, 0),
    archives: {
      fullArchive: path.relative(
        repoRoot,
        path.join(path.dirname(outDir), `${path.basename(outDir)}.tar.gz`),
      ),
    },
  };

  for (const bundle of bundles) {
    const outputPath = path.join(outDir, bundle.filename);
    const content = await renderBundle(bundle, generatedAt);
    await fs.writeFile(outputPath, content, "utf8");
  }

  generatedFiles.push("manifest.json");
  await fs.writeFile(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  const summaryLines = [
    "# Canonical Docs Manifest",
    "",
    `Generated: ${generatedAt}`,
    `Output Directory: ${path.relative(repoRoot, outDir) || "."}`,
    "",
    ...bundles.flatMap((bundle) => [
      `## ${bundle.filename}`,
      "",
      ...bundle.files.map((file) => `- ${file}`),
      "",
    ]),
    "## Archives",
    "",
    `- ${manifest.archives.fullArchive}`,
    "",
  ];

  generatedFiles.push("manifest.md");
  await fs.writeFile(
    path.join(outDir, "manifest.md"),
    `${summaryLines.join("\n")}\n`,
    "utf8",
  );

  const fullArchivePath = path.join(
    path.dirname(outDir),
    `${path.basename(outDir)}.tar.gz`,
  );
  await createTarGz(fullArchivePath, outDir, generatedFiles);

  return manifest;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const bundles = await buildBundles();

  if (options.listOnly) {
    printBundleList(bundles);
    return;
  }

  const manifest = await writeOutputs(options.outDir, bundles);
  console.log(`Canonical docs bundles written to ${path.relative(repoRoot, options.outDir) || "."}`);
  for (const bundle of manifest.bundles) {
    console.log(`- ${bundle.filename} (${bundle.sourceCount} sources)`);
  }
  console.log(`- archive: ${manifest.archives.fullArchive}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
