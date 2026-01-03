import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const ARCHIVE_DIR = path.join(repoRoot, "archives");
const WORKSPACE_DIRS = ["packages"];
const DOC_TOKENS = ["fdr", "prd", "spec"];

const args = new Set(process.argv.slice(2));
const clean = args.has("--clean");
const includeApps = args.has("--include-apps");

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const sanitizePackageName = (name) =>
  name.replace(/^@/, "").replace(/\//g, "-");

const isDocFile = (fileName) => {
  if (!fileName.toLowerCase().endsWith(".md")) {
    return false;
  }
  const lower = fileName.toLowerCase();
  return DOC_TOKENS.some((token) => lower.includes(token));
};

const listPackageDirs = async () => {
  const workspaceDirs = includeApps
    ? [...WORKSPACE_DIRS, "apps"]
    : WORKSPACE_DIRS;
  const packageDirs = [];
  for (const workspaceDir of workspaceDirs) {
    const fullWorkspacePath = path.join(repoRoot, workspaceDir);
    if (!(await pathExists(fullWorkspacePath))) {
      continue;
    }
    const entries = await fs.readdir(fullWorkspacePath, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const pkgDir = path.join(fullWorkspacePath, entry.name);
      const pkgJsonPath = path.join(pkgDir, "package.json");
      if (await pathExists(pkgJsonPath)) {
        packageDirs.push(pkgDir);
      }
    }
  }
  return packageDirs;
};

const readPackageMeta = async (pkgDir) => {
  const pkgJsonPath = path.join(pkgDir, "package.json");
  const raw = await fs.readFile(pkgJsonPath, "utf8");
  const parsed = JSON.parse(raw);
  return {
    name: parsed.name ?? path.basename(pkgDir),
    version: parsed.version ?? "unknown",
  };
};

const copyDocsForPackage = async (pkgDir, pkgName, version) => {
  const docsDir = path.join(pkgDir, "docs");
  if (!(await pathExists(docsDir))) {
    return [];
  }
  const entries = await fs.readdir(docsDir, { withFileTypes: true });
  const copied = [];
  for (const entry of entries) {
    if (!entry.isFile() || !isDocFile(entry.name)) {
      continue;
    }
    const slug = sanitizePackageName(pkgName);
    const destName = `${slug}__v${version}__${entry.name}`;
    const srcPath = path.join(docsDir, entry.name);
    const destPath = path.join(ARCHIVE_DIR, destName);
    await fs.copyFile(srcPath, destPath);
    copied.push(destName);
  }
  return copied;
};

const cleanArchiveDir = async () => {
  if (!(await pathExists(ARCHIVE_DIR))) {
    return;
  }
  const entries = await fs.readdir(ARCHIVE_DIR, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => fs.unlink(path.join(ARCHIVE_DIR, entry.name))),
  );
};

const main = async () => {
  if (clean) {
    await cleanArchiveDir();
  }
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  const packageDirs = await listPackageDirs();
  let totalFiles = 0;
  let packagesWithDocs = 0;
  for (const pkgDir of packageDirs) {
    const { name, version } = await readPackageMeta(pkgDir);
    const copied = await copyDocsForPackage(pkgDir, name, version);
    if (copied.length > 0) {
      packagesWithDocs += 1;
      totalFiles += copied.length;
    }
  }
  console.log(
    `Archived ${totalFiles} files from ${packagesWithDocs} packages into ${ARCHIVE_DIR}.`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
