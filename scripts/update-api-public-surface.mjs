import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "docs/api/public-surface.md");

const packageRoots = [
  "packages/sdk",
  "packages/lineage",
  "packages/governance",
  "packages/compiler",
  "packages/core",
  "packages/host",
  "packages/codegen",
];

const checkOnly = process.argv.includes("--check");

function sourceFileFromTypesPath(packageRoot, typesPath) {
  const distRelative = typesPath
    .replace(/^\.\//, "")
    .replace(/^dist\//, "")
    .replace(/\.d\.ts$/, ".ts");

  return path.join(repoRoot, packageRoot, "src", distRelative);
}

async function readJson(relativePath) {
  return JSON.parse(
    await fs.readFile(path.join(repoRoot, relativePath), "utf8"),
  );
}

function add(target, name) {
  if (name && name !== "default") {
    target.add(name);
  }
}

function hasExportModifier(node) {
  return Boolean(
    node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
}

function hasDefaultModifier(node) {
  return Boolean(
    node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword),
  );
}

function exportedDeclarationName(node) {
  return node.name && ts.isIdentifier(node.name) ? node.name.text : null;
}

function resolveModulePath(fromFile, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const withoutJs = specifier.replace(/\.js$/, ".ts");
  const resolved = path.resolve(path.dirname(fromFile), withoutJs);

  if (resolved.endsWith(".ts")) {
    return resolved;
  }

  return path.join(resolved, "index.ts");
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function collectExports(filePath, seen = new Set()) {
  const normalized = path.normalize(filePath);
  if (seen.has(normalized)) {
    return { values: new Set(), types: new Set() };
  }
  seen.add(normalized);

  if (!(await pathExists(normalized))) {
    throw new Error(`Public API source barrel not found: ${path.relative(repoRoot, normalized)}`);
  }

  const sourceText = await fs.readFile(normalized, "utf8");
  const source = ts.createSourceFile(
    normalized,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const values = new Set();
  const types = new Set();

  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const specifier of statement.exportClause.elements) {
          const exportedName = specifier.name.text;
          const typeOnly = statement.isTypeOnly || specifier.isTypeOnly;
          add(typeOnly ? types : values, exportedName);
        }
        continue;
      }

      const moduleSpecifier = statement.moduleSpecifier;
      if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
        const recursivePath = resolveModulePath(normalized, moduleSpecifier.text);
        if (recursivePath) {
          const nested = await collectExports(recursivePath, seen);
          nested.values.forEach((name) => add(values, name));
          nested.types.forEach((name) => add(types, name));
        }
      }
      continue;
    }

    if (!hasExportModifier(statement)) {
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          add(values, declaration.name.text);
        }
      }
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      if (hasDefaultModifier(statement)) {
        add(values, "default");
      } else {
        add(values, exportedDeclarationName(statement));
      }
      continue;
    }

    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)
    ) {
      add(types, exportedDeclarationName(statement));
    }
  }

  return { values, types };
}

function sortNames(names) {
  return [...names].sort((left, right) => left.localeCompare(right));
}

function packageSpecifier(packageName, subpath) {
  return subpath === "." ? packageName : `${packageName}${subpath.slice(1)}`;
}

async function collectPublicEntries() {
  const entries = [];

  for (const packageRoot of packageRoots) {
    const packageJson = await readJson(`${packageRoot}/package.json`);
    const packageName = packageJson.name;
    const exportEntries = Object.entries(packageJson.exports ?? {});

    for (const [subpath, config] of exportEntries) {
      const typesPath = typeof config === "string" ? config : config.types;
      if (!typesPath) {
        continue;
      }

      const sourceFile = sourceFileFromTypesPath(packageRoot, typesPath);
      const collected = await collectExports(sourceFile);

      entries.push({
        packageName,
        subpath,
        specifier: packageSpecifier(packageName, subpath),
        sourceFile: path.relative(repoRoot, sourceFile),
        values: sortNames(collected.values),
        types: sortNames(collected.types),
      });
    }
  }

  return entries.sort((left, right) =>
    left.specifier.localeCompare(right.specifier),
  );
}

function renderNameList(names) {
  if (names.length === 0) {
    return ["_No named exports detected._"];
  }

  return names.map((name) => `- \`${name}\``);
}

function renderInventory(entries) {
  const lines = [
    "# Public Surface Inventory",
    "",
    "> Generated from package `exports` and source barrels. Do not edit by hand.",
    ">",
    "> Run `pnpm docs:api:inventory` to update this page.",
    "",
    "This page is a drift guard. Use the curated API reference pages for usage guidance.",
    "",
  ];

  let currentPackage = "";

  for (const entry of entries) {
    if (entry.packageName !== currentPackage) {
      currentPackage = entry.packageName;
      lines.push(`## ${currentPackage}`, "");
    }

    lines.push(`### ${entry.specifier}`, "");
    lines.push(`_Source: \`${entry.sourceFile}\`_`, "");
    lines.push("#### Values", "");
    lines.push(...renderNameList(entry.values), "");
    lines.push("#### Types", "");
    lines.push(...renderNameList(entry.types), "");
  }

  return `${lines.join("\n").trim()}\n`;
}

async function main() {
  const inventory = renderInventory(await collectPublicEntries());

  if (checkOnly) {
    const current = await fs.readFile(outPath, "utf8").catch(() => "");
    if (current !== inventory) {
      console.error("docs/api/public-surface.md is out of date.");
      console.error("Run `pnpm docs:api:inventory` and commit the result.");
      process.exitCode = 1;
    }
    return;
  }

  await fs.writeFile(outPath, inventory);
  console.log(`Updated ${path.relative(repoRoot, outPath)}`);
}

await main();
