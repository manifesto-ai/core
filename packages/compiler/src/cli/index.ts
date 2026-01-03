#!/usr/bin/env node
/**
 * MEL Compiler CLI
 * Command-line interface for compiling MEL source code
 */

import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";
import { compile, check, parseSource, tokenize } from "../index.js";
import { formatDiagnostics } from "./formatter.js";

const program = new Command();

program
  .name("mel")
  .description("MEL (Manifesto Expression Language) Compiler")
  .version("0.1.0");

// ============ compile command ============

program
  .command("compile")
  .description("Compile MEL source file to Manifesto Schema IR (JSON)")
  .argument("<input>", "Input .mel file")
  .option("-o, --output <output>", "Output file (default: <input>.json)")
  .option("--pretty", "Pretty-print JSON output", false)
  .option("--stdout", "Output to stdout instead of file", false)
  .action((input: string, options: { output?: string; pretty: boolean; stdout: boolean }) => {
    const inputPath = resolve(input);

    if (!existsSync(inputPath)) {
      console.error(`Error: File not found: ${inputPath}`);
      process.exit(1);
    }

    const source = readFileSync(inputPath, "utf-8");
    const result = compile(source);

    if (!result.success) {
      console.error("Compilation failed:\n");
      console.error(formatDiagnostics(result.errors, source, inputPath));
      process.exit(1);
    }

    const schema = result.schema;
    const json = options.pretty
      ? JSON.stringify(schema, null, 2)
      : JSON.stringify(schema);

    if (options.stdout) {
      console.log(json);
    } else {
      const outputPath = options.output
        ? resolve(options.output)
        : inputPath.replace(/\.mel$/, ".json");

      writeFileSync(outputPath, json, "utf-8");
      console.log(`Compiled: ${inputPath} -> ${outputPath}`);
    }
  });

// ============ check command ============

program
  .command("check")
  .description("Check MEL source file for errors (no output)")
  .argument("<input>", "Input .mel file")
  .action((input: string) => {
    const inputPath = resolve(input);

    if (!existsSync(inputPath)) {
      console.error(`Error: File not found: ${inputPath}`);
      process.exit(1);
    }

    const source = readFileSync(inputPath, "utf-8");
    const errors = check(source);

    if (errors.length > 0) {
      console.error("Errors found:\n");
      console.error(formatDiagnostics(errors, source, inputPath));
      process.exit(1);
    }

    console.log(`No errors found in ${inputPath}`);
  });

// ============ parse command ============

program
  .command("parse")
  .description("Parse MEL source file and output AST (for debugging)")
  .argument("<input>", "Input .mel file")
  .option("--stdout", "Output to stdout", true)
  .action((input: string, options: { stdout: boolean }) => {
    const inputPath = resolve(input);

    if (!existsSync(inputPath)) {
      console.error(`Error: File not found: ${inputPath}`);
      process.exit(1);
    }

    const source = readFileSync(inputPath, "utf-8");
    const { program: ast, diagnostics } = parseSource(source);

    if (diagnostics.some(d => d.severity === "error")) {
      console.error("Parse errors:\n");
      console.error(formatDiagnostics(diagnostics.filter(d => d.severity === "error"), source, inputPath));
      process.exit(1);
    }

    console.log(JSON.stringify(ast, null, 2));
  });

// ============ tokens command ============

program
  .command("tokens")
  .description("Tokenize MEL source file (for debugging)")
  .argument("<input>", "Input .mel file")
  .action((input: string) => {
    const inputPath = resolve(input);

    if (!existsSync(inputPath)) {
      console.error(`Error: File not found: ${inputPath}`);
      process.exit(1);
    }

    const source = readFileSync(inputPath, "utf-8");
    const { tokens, diagnostics } = tokenize(source);

    if (diagnostics.some(d => d.severity === "error")) {
      console.error("Lexer errors:\n");
      console.error(formatDiagnostics(diagnostics.filter(d => d.severity === "error"), source, inputPath));
      process.exit(1);
    }

    for (const token of tokens) {
      console.log(
        `${token.kind.padEnd(20)} ${JSON.stringify(token.lexeme).padEnd(20)} @ ${token.location.start.line}:${token.location.start.column}`
      );
    }
  });

// Parse command line
program.parse();
