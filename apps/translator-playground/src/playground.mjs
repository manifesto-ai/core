import fs from "node:fs";
import path from "node:path";

import { createDefaultPipeline, exportTo, validateGraph } from "@manifesto-ai/translator";
import { OpenAIAdapter } from "@manifesto-ai/translator-adapter-openai";
import { createLexicon, createResolver } from "@manifesto-ai/intent-ir";
import { manifestoExporter } from "@manifesto-ai/translator-target-manifesto";
import { createRunContext, serializeDiagnostics } from "./results.mjs";

function findEnvFile(filename) {
  let current = process.cwd();
  while (true) {
    const candidate = path.join(current, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function loadEnvFile(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const envFile = findEnvFile(".env.local");
if (envFile) {
  loadEnvFile(envFile);
}

const args = process.argv.slice(2);
let model = process.env.MANIFESTO_LLM_MODEL ?? "gpt-4o-mini";
let caseId = "playground";
let saveResults = true;
const textParts = [];
let skipDoubleDash = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--") {
    skipDoubleDash = true;
    continue;
  }
  if (arg === "--model" && args[i + 1]) {
    model = args[i + 1];
    i += 1;
    continue;
  }
  if (arg === "--case" && args[i + 1]) {
    caseId = args[i + 1];
    i += 1;
    continue;
  }
  if (arg === "--no-save") {
    saveResults = false;
    continue;
  }
  if (arg.startsWith("--model=")) {
    model = arg.slice("--model=".length);
    continue;
  }
  if (arg.startsWith("--case=")) {
    caseId = arg.slice("--case=".length);
    continue;
  }
  if (skipDoubleDash) {
    textParts.push(arg);
    continue;
  }
  textParts.push(arg);
}

const text = textParts.join(" ").trim() || "Create a project";
const pipelineOptions = { maxChunkSize: 2000 };
const runContext = saveResults
  ? createRunContext({
      label: "playground",
      model,
      pipelineOptions,
    })
  : null;

const llm = new OpenAIAdapter({ model });
const pipeline = createDefaultPipeline(llm, pipelineOptions);

const result = await pipeline.process(text);
const validation = validateGraph(result.graph);
const diagnostics = serializeDiagnostics(result.diagnostics);

console.log("Input:", text);
console.log("Graph valid:", validation.valid);
console.log("Graph nodes:", result.graph.nodes.length);
console.log("Graph:", JSON.stringify(result.graph, null, 2));

if (!validation.valid) {
  console.log("Graph error:", validation.error.code, validation.error.message);
}

const lexicon = createLexicon({
  events: {
    CREATE: {
      eventClass: "CREATE",
      thetaFrame: {
        required: ["TARGET"],
        optional: [],
        restrictions: {
          TARGET: { termKinds: ["entity"], entityTypes: ["project"] },
        },
      },
    },
  },
  entities: {
    project: { fields: {} },
  },
});

const resolver = createResolver();
const bundle = await exportTo(
  manifestoExporter,
  { graph: result.graph, diagnostics: result.diagnostics, source: { text } },
  { lexicon, resolver }
);

console.log("Bundle:", JSON.stringify(bundle, null, 2));

if (runContext) {
  runContext.writeCase(caseId, {
    status: validation.valid ? "ok" : "invalid",
    caseId,
    input: text,
    model,
    pipelineOptions,
    validation,
    result: {
      meta: result.meta,
      graph: result.graph,
      diagnostics,
    },
    bundle,
  });
  runContext.finalize();
  console.log("Saved results to:", runContext.runDir);
}
