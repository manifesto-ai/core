#!/usr/bin/env npx tsx
/**
 * MEL Compile Script
 *
 * Compiles translator.mel to translator-compiled.json
 *
 * Usage: npx tsx scripts/compile-mel.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

// Import from compiler dist (lexer, parser, generator are not exported from src)
// Use relative path since translator doesn't depend on compiler
import { tokenize } from "../../compiler/dist/lexer/lexer.js";
import { parse } from "../../compiler/dist/parser/parser.js";
import { generate } from "../../compiler/dist/generator/ir.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const MEL_PATH = path.join(ROOT, "src/domain/translator.mel");
const OUTPUT_PATH = path.join(ROOT, "src/domain/translator-compiled.json");

function main() {
  console.log("🔧 Compiling translator.mel...\n");

  // Read MEL source
  if (!fs.existsSync(MEL_PATH)) {
    console.error(`❌ MEL file not found: ${MEL_PATH}`);
    process.exit(1);
  }

  const melSource = fs.readFileSync(MEL_PATH, "utf-8");
  console.log(`📄 Read ${melSource.length} bytes from translator.mel`);

  // Step 1: Tokenize
  const lexResult = tokenize(melSource, "translator.mel");
  if (lexResult.diagnostics.length > 0) {
    console.error("\n❌ Lexer errors:");
    for (const diag of lexResult.diagnostics) {
      console.error(`  ${diag.severity}: ${diag.message}`);
      if (diag.location) {
        console.error(`    at line ${diag.location.start.line}:${diag.location.start.column}`);
      }
    }
    process.exit(1);
  }
  console.log(`✅ Tokenized: ${lexResult.tokens.length} tokens`);

  // Step 2: Parse
  const parseResult = parse(lexResult.tokens);
  if (parseResult.diagnostics.length > 0) {
    console.error("\n❌ Parser errors:");
    for (const diag of parseResult.diagnostics) {
      console.error(`  ${diag.severity}: ${diag.message}`);
      if (diag.location) {
        console.error(`    at line ${diag.location.start.line}:${diag.location.start.column}`);
      }
    }
    process.exit(1);
  }
  if (!parseResult.program) {
    console.error("\n❌ Parser produced no program");
    process.exit(1);
  }
  console.log(`✅ Parsed: domain "${parseResult.program.domain.name}"`);

  // Step 3: Generate DomainSchema
  const genResult = generate(parseResult.program);
  if (genResult.diagnostics.length > 0) {
    console.error("\n❌ Generator errors:");
    for (const diag of genResult.diagnostics) {
      console.error(`  ${diag.severity}: ${diag.message}`);
      if (diag.location) {
        console.error(`    at line ${diag.location.start.line}:${diag.location.start.column}`);
      }
    }
    // Continue if there are only warnings
    const errors = genResult.diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) {
      process.exit(1);
    }
  }
  if (!genResult.schema) {
    console.error("\n❌ Generator produced no schema");
    process.exit(1);
  }

  // Calculate content hash
  const schemaJson = JSON.stringify(genResult.schema, null, 2);
  const hash = crypto.createHash("sha256").update(schemaJson).digest("hex").slice(0, 16);

  // Update schema with proper hash
  const schema = {
    ...genResult.schema,
    hash: `mel:${hash}`,
  };

  // Write output
  const output = JSON.stringify(schema, null, 2);
  fs.writeFileSync(OUTPUT_PATH, output);
  console.log(`\n✅ Generated: ${OUTPUT_PATH}`);
  console.log(`   - id: ${schema.id}`);
  console.log(`   - version: ${schema.version}`);
  console.log(`   - hash: ${schema.hash}`);
  console.log(`   - types: ${Object.keys(schema.types || {}).length}`);
  console.log(`   - state fields: ${Object.keys(schema.state?.fields || {}).length}`);
  console.log(`   - computed: ${Object.keys(schema.computed?.fields || {}).length}`);
  console.log(`   - actions: ${Object.keys(schema.actions || {}).length}`);
}

main();
