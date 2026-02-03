# AI Agent Integration

> How AI collaborates with Manifesto

## Overview

In Manifesto, AI agents are Actors equal to humans.
This guide covers patterns for AI generating and executing Intents.

## The Translator Pipeline

Manifesto provides a Translator that converts natural language to Intent Graphs.

```
Natural Language → Translator → Intent Graph → Manifesto Core
```

### Pipeline Architecture

```typescript
import { TranslatorPipeline } from "@manifesto-ai/translator";
import { OpenAIAdapter } from "@manifesto-ai/translator-adapter-openai";
import { manifestoExporter } from "@manifesto-ai/translator-target-manifesto";

// 1. Create pipeline with LLM adapter
const pipeline = new TranslatorPipeline(
  decomposer,   // Breaks text into chunks
  translator,   // Translates chunks to Intent IR
  merger,       // Merges chunk graphs
  { concurrency: 5 }
);

// 2. Process natural language
const result = await pipeline.process(
  "Add a task to review the PR and mark it as high priority"
);

// 3. Export to Manifesto format
const bundle = await manifestoExporter.export(
  { graph: result.graph },
  exportContext
);
```

### Intent Graph Structure

```typescript
interface IntentGraph {
  readonly nodes: readonly IntentNode[];
  readonly meta?: GraphMeta;
}

interface IntentNode {
  readonly id: IntentNodeId;
  readonly ir: IntentIR;              // Intent IR instance
  readonly resolution: Resolution;    // Resolved | Ambiguous | Abstract
  readonly dependsOn: readonly IntentNodeId[];
}
```

### Resolution Status

| Status | Meaning | Action |
|--------|---------|--------|
| **Resolved** | All required info complete | Ready to execute |
| **Ambiguous** | Some info unclear | Needs clarification |
| **Abstract** | Too vague | Needs decomposition |

## Basic Usage

### Step 1: Set Up Pipeline

```typescript
import {
  TranslatorPipeline,
  SentenceBasedDecomposer,
  LlmTranslator,
  ConservativeMerger
} from "@manifesto-ai/translator";
import { OpenAIAdapter } from "@manifesto-ai/translator-adapter-openai";

const llm = new OpenAIAdapter({
  model: "gpt-4",
  apiKey: process.env.OPENAI_API_KEY
});

const pipeline = new TranslatorPipeline(
  new SentenceBasedDecomposer(),
  new LlmTranslator(llm),
  new ConservativeMerger()
);
```

### Step 2: Natural Language → Intent Graph

```typescript
const result = await pipeline.process(
  "Add a task to review the PR and mark it as high priority"
);

// Check pipeline result
console.log(result.meta);
// { chunkCount: 1, nodeCount: 2, processingTimeMs: 1234, hasOverlap: false }

// Inspect nodes
for (const node of result.graph.nodes) {
  console.log(node.ir.event.lemma);  // "add", "mark"
  console.log(node.resolution.status);  // "Resolved"
}
```

### Step 3: Intent Graph → Manifesto Intent

```typescript
import { manifestoExporter } from "@manifesto-ai/translator-target-manifesto";

const bundle = await manifestoExporter.export(
  { graph: result.graph },
  {
    resolver: myResolver,
    lexicon: myLexicon,
    strictValidation: true
  }
);

// Execute ready steps
for (const step of bundle.invocationPlan.steps) {
  if (step.lowering.status === "ready") {
    await app.dispatch(step.lowering.intentBody);
  }
}
```

## Human-in-the-Loop Pattern

AI-generated Intents that require human approval:

```typescript
async function processWithHumanApproval(userMessage: string) {
  // 1. AI generates Intent Graph
  const result = await pipeline.process(userMessage);

  // 2. Check for ambiguous nodes
  const ambiguous = result.graph.nodes.filter(
    n => n.resolution.status === "Ambiguous"
  );

  if (ambiguous.length > 0) {
    // 3. Collect clarification questions
    const questions = ambiguous.flatMap(n =>
      n.resolution.questions ?? []
    );

    // 4. Ask user
    const answers = await askUser(questions);

    // 5. Re-process with answers
    // (Implementation depends on pipeline configuration)
  }

  // 6. Show plan to user for approval
  const bundle = await manifestoExporter.export(
    { graph: result.graph },
    exportContext
  );

  const approved = await getUserApproval({
    steps: bundle.invocationPlan.steps,
    summary: generateSummary(bundle)
  });

  if (!approved) {
    return { status: "cancelled" };
  }

  // 7. Execute approved intents
  const results = [];
  for (const step of bundle.invocationPlan.steps) {
    if (step.lowering.status === "ready") {
      const result = await app.dispatch(step.lowering.intentBody);
      results.push(result);
    }
  }

  return { status: "completed", results };
}
```

## Authority Configuration

Configure Authority for AI Actors:

```typescript
// Register AI-specific authority
world.registerAuthority("ai-agent-authority", {
  evaluate: async (proposal) => {
    const { actor, intent } = proposal;

    // Check if actor is AI
    if (actor.type !== "ai") {
      return { decision: "approved" };
    }

    // Auto-approve safe actions
    const safeActions = ["addTask", "updateTaskTitle", "completeTask"];
    if (safeActions.includes(intent.type)) {
      return { decision: "approved" };
    }

    // Require human approval for dangerous actions
    const dangerousActions = ["deleteAll", "resetData", "exportData"];
    if (dangerousActions.includes(intent.type)) {
      return {
        decision: "pending",
        reason: "AI action requires human approval",
        escalateTo: "human-authority"
      };
    }

    // Default: approved with audit log
    return {
      decision: "approved",
      audit: {
        flag: "ai-action",
        timestamp: Date.now()
      }
    };
  }
});
```

## MEL Generation Pattern

AI generating MEL code directly:

```typescript
async function generateMelAction(description: string, schema: Schema) {
  const prompt = `
Generate a MEL action for: ${description}

Schema context:
${JSON.stringify(schema, null, 2)}

Rules:
- Use 'when' guards for re-entry safety
- Use state paths from the schema
- Keep actions focused and single-purpose

Example:
action addTask(title: string) {
  when true {
    patch data.tasks = append(data.tasks, {
      id: input.id,
      title: input.title,
      completed: false
    })
  }
}
`;

  const melCode = await llm.generate(prompt);

  // Validate generated MEL
  const validated = melCompiler.validate(melCode);

  if (validated.errors.length > 0) {
    // Log errors for improvement
    console.error("MEL validation failed:", validated.errors);
    return null;
  }

  return melCode;
}
```

## Extension Candidates

When Intent lowering fails, the pipeline generates extension candidates:

```typescript
const bundle = await manifestoExporter.export(
  { graph: result.graph },
  exportContext
);

// Check for extension candidates
for (const candidate of bundle.extensionCandidates) {
  console.log("Suggested MEL extension:");
  console.log(candidate.payload.template);
  console.log("Would enable:", candidate.wouldEnable);
}

// Example candidate:
// {
//   nodeId: "node_1",
//   kind: "mel",
//   payload: {
//     template: "action markHighPriority(taskId: string) { ... }",
//     reason: "UNSUPPORTED_EVENT"
//   },
//   wouldEnable: ["node_1"]
// }
```

## Best Practices

### 1. Always Check Resolution Status

```typescript
// Don't execute ambiguous or abstract nodes
const readyNodes = result.graph.nodes.filter(
  n => n.resolution.status === "Resolved"
);
```

### 2. Configure Appropriate Authority

```typescript
// AI actions should have explicit authority rules
// Don't use permissive defaults for AI actors
```

### 3. Use Trace for Auditing

```typescript
// Every AI action is traced
const result = await app.dispatch(intent);
await auditLog.record({
  actor: aiActor,
  intent,
  trace: result.trace,
  timestamp: Date.now()
});
```

### 4. Start with Conservative Automation

```typescript
// Phase 1: All AI actions require approval
// Phase 2: Safe actions auto-approved
// Phase 3: Learned patterns auto-approved
```

### 5. Handle Failures Gracefully

```typescript
for (const step of bundle.invocationPlan.steps) {
  switch (step.lowering.status) {
    case "ready":
      await execute(step);
      break;
    case "deferred":
      await queueForClarification(step);
      break;
    case "failed":
      await logFailure(step);
      await suggestExtension(step);
      break;
  }
}
```

## Diagnostics

The pipeline provides rich diagnostics:

```typescript
const result = await pipeline.process(text);

// Access diagnostics
const diagnostics = result.diagnostics;

// Warnings
for (const warning of diagnostics.warnings) {
  console.warn(warning.message);
}

// Info
for (const info of diagnostics.info) {
  console.log(info.message);
}
```

## See Also

- [AI Native OS Layer](/concepts/ai-native-os-layer) — Core identity
- [World Concept](/concepts/world) — Authority details
- [Schema Evolution](/guides/schema-evolution) — AI-driven schema changes
- [Effect Handlers](/guides/effect-handlers) — External integration patterns
