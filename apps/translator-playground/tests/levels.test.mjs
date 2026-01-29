import fs from "node:fs";
import path from "node:path";

import { describe, it, expect, afterAll } from "vitest";
import { createDefaultPipeline, exportTo, validateGraph } from "@manifesto-ai/translator";
import { OpenAIAdapter } from "@manifesto-ai/translator-adapter-openai";
import { createLexicon, createResolver } from "@manifesto-ai/intent-ir";
import { manifestoExporter } from "@manifesto-ai/translator-target-manifesto";
import { createRunContext, serializeDiagnostics } from "../src/results.mjs";

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

const apiKey = process.env.OPENAI_API_KEY;
const runTest = apiKey ? it : it.skip;
const model = process.env.MANIFESTO_LLM_MODEL ?? "gpt-4o-mini";
const pipelineOptions = { maxChunkSize: 2000 };
const saveResults =
  !!apiKey && process.env.MANIFESTO_SAVE_RESULTS !== "0" && process.env.MANIFESTO_SAVE_RESULTS !== "false";
const runContext = saveResults
  ? createRunContext({
      label: "levels-test",
      model,
      pipelineOptions,
    })
  : null;

const lexicon = createLexicon({
  events: Object.fromEntries(
    [
      "CREATE",
      "ADD",
      "UPDATE",
      "DELETE",
      "ASSIGN",
      "NOTIFY",
      "MOVE",
      "SET",
      "CHANGE",
      "COMPLETE",
      "PRIORITIZE",
      "SCHEDULE",
    ].map((lemma) => [
      lemma,
      {
        eventClass: "CREATE",
        thetaFrame: {
          required: [],
          optional: [],
          restrictions: {},
        },
      },
    ])
  ),
  entities: {
    project: { fields: {} },
    task: { fields: {} },
    user: { fields: {} },
    team: { fields: {} },
    notification: { fields: {} },
    milestone: { fields: {} },
    sprint: { fields: {} },
    board: { fields: {} },
  },
});

const resolver = createResolver();

async function runPipeline(text, caseId) {
  const llm = new OpenAIAdapter({ model });
  const pipeline = createDefaultPipeline(llm, pipelineOptions);
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  try {
    const result = await pipeline.process(text);
    const validation = validateGraph(result.graph);
    const bundle = await exportTo(
      manifestoExporter,
      { graph: result.graph, diagnostics: result.diagnostics, source: { text } },
      { lexicon, resolver }
    );
    const diagnostics = serializeDiagnostics(result.diagnostics);

    if (runContext) {
      runContext.writeCase(caseId, {
        status: validation.valid ? "ok" : "invalid",
        caseId,
        input: text,
        model,
        pipelineOptions,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
        validation,
        result: {
          meta: result.meta,
          graph: result.graph,
          diagnostics,
        },
        bundle,
      });
    }

    return { result, validation, bundle };
  } catch (error) {
    if (runContext) {
      runContext.writeCase(caseId, {
        status: "error",
        caseId,
        input: text,
        model,
        pipelineOptions,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    }
    throw error;
  }
}

function assertBundle(bundle) {
  expect(bundle.invocationPlan.steps.length).toBeGreaterThan(0);
  expect(bundle.invocationPlan.dependencyEdges).toBeDefined();
  expect(bundle.invocationPlan.abstractNodes).toBeDefined();

  const total =
    bundle.meta.readyCount + bundle.meta.deferredCount + bundle.meta.failedCount;
  expect(total).toBe(bundle.meta.nodeCount);

  for (const step of bundle.invocationPlan.steps) {
    if (step.lowering.status === "ready") {
      expect(step.lowering.intentBody).toBeDefined();
    }
    if (step.lowering.status === "failed") {
      expect(step.lowering.failure?.kind).toBeDefined();
      expect(step.lowering.failure?.details).toBeDefined();
    }
    if (step.lowering.status === "deferred") {
      expect(step.lowering.reason).toBeDefined();
    }
  }
}

describe("Translator v1 playground - complexity levels", () => {
  runTest("Level 1: simple command", async () => {
    const text = "Create a project called Apollo.";
    const { validation, bundle } = await runPipeline(text, "level-1-simple");
    expect(validation.valid).toBe(true);
    assertBundle(bundle);
  });

  runTest("Level 2: multi-step request", async () => {
    const text =
      "Create a project named Apollo and add three tasks: design, build, and test.";
    const { validation, bundle } = await runPipeline(text, "level-2-multi-step");
    expect(validation.valid).toBe(true);
    assertBundle(bundle);
  });

  runTest("Level 3: assignments and scheduling", async () => {
    const text =
      "Create a project, add tasks for design and implementation, assign them to Alice and Bob, and set due dates next week.";
    const { validation, bundle } = await runPipeline(text, "level-3-assignments");
    expect(validation.valid).toBe(true);
    assertBundle(bundle);
  });

  runTest("Level 4: state changes and notifications", async () => {
    const text =
      "If any task is overdue, move it to the backlog, notify the team, and mark the status as blocked.";
    const { validation, bundle } = await runPipeline(text, "level-4-notifications");
    expect(validation.valid).toBe(true);
    assertBundle(bundle);
  });

  runTest("Level 5: mid-sized PRD", async () => {
    const text = `Build a task management system.
Create projects and tasks, allow assigning tasks to users, and support status changes.
Add a notification rule: when a task is marked complete, notify the project owner.
Include a weekly summary action that lists overdue tasks and upcoming milestones.
Provide a way to prioritize tasks and move them between sprints.`;

    const { validation, bundle } = await runPipeline(text, "level-5-prd");
    expect(validation.valid).toBe(true);
    assertBundle(bundle);
  });
});

afterAll(() => {
  if (runContext) {
    runContext.finalize();
  }
});
