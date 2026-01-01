/**
 * Todo Example - Full Pipeline Demonstration
 *
 * Pipeline:
 *   MEL Source → Compiler → Schema → Host → Effect Handlers (effect-utils)
 *
 * This example demonstrates:
 * 1. Compiling MEL source to DomainSchema
 * 2. Creating Host with the compiled schema
 * 3. Registering effect handlers using effect-utils
 * 4. Dispatching intents and observing state changes
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { compile } from "@manifesto-ai/compiler";
import { createHost, createIntent } from "@manifesto-ai/host";
import { registerTodoHandlers, seedTodos, resetStorage } from "./handlers.js";

// =============================================================================
// Helpers
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function printSnapshot(host: Awaited<ReturnType<typeof createHost>>, label: string) {
  const snapshot = await host.getSnapshot();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📸 Snapshot: ${label}`);
  console.log("=".repeat(60));

  // Debug: print raw snapshot structure
  console.log("\n[DEBUG] Snapshot:", JSON.stringify(snapshot, null, 2));

  const data = (snapshot?.data ?? {}) as Record<string, unknown>;
  const computed = (snapshot?.computed ?? {}) as Record<string, unknown>;

  // Get todos - might be at data.todos or directly at root
  const todos = (data.todos ?? []) as Array<{ id: string; title: string; completed: boolean }>;

  console.log("\n📋 Todos:");
  if (todos && todos.length > 0) {
    todos.forEach((todo, i) => {
      const status = todo.completed ? "✅" : "⬜";
      console.log(`   ${i + 1}. ${status} ${todo.title} (${todo.id})`);
    });
  } else {
    console.log("   (empty)");
  }

  // Calculate stats
  const total = todos.length;
  const activeCount = todos.filter(t => !t.completed).length;
  const completedCount = todos.filter(t => t.completed).length;

  console.log("\n📊 Stats:");
  console.log(`   Total: ${total}`);
  console.log(`   Active: ${activeCount}`);
  console.log(`   Completed: ${completedCount}`);
  console.log(`   Computed totalCount: ${computed.totalCount ?? "N/A"}`);
  console.log(`   Computed hasTodos: ${computed.hasTodos ?? "N/A"}`);

  console.log("\n🔧 System:");
  console.log(`   Filter: ${data.filter ?? "all"}`);
  console.log(`   Status: ${data.status ?? "idle"}`);
  console.log(`   Version: ${snapshot?.meta?.version ?? "N/A"}`);
}

async function runIntent(
  host: Awaited<ReturnType<typeof createHost>>,
  action: string,
  input: Record<string, unknown> = {}
) {
  console.log(`\n🚀 Dispatching: ${action}(${JSON.stringify(input)})`);

  const intent = createIntent(action, input);
  const result = await host.dispatch(intent);

  console.log(`   Result: ${result.status}`);

  if (result.status === "error") {
    console.error("   Error:", result.snapshot?.system?.lastError);
  }

  return result;
}

function printSnapshotFromResult(result: { snapshot: unknown }, label: string) {
  const snapshot = result.snapshot as {
    data?: Record<string, unknown>;
    computed?: Record<string, unknown>;
    meta?: { version: number };
    system?: { status: string };
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📸 Snapshot: ${label}`);
  console.log("=".repeat(60));

  const data = snapshot?.data ?? {};
  const computed = snapshot?.computed ?? {};

  // Get todos
  const todos = (data.todos ?? []) as Array<{ id: string; title: string; completed: boolean }>;

  console.log("\n📋 Todos:");
  if (todos && todos.length > 0) {
    todos.forEach((todo, i) => {
      const status = todo.completed ? "✅" : "⬜";
      console.log(`   ${i + 1}. ${status} ${todo.title} (${todo.id})`);
    });
  } else {
    console.log("   (empty)");
  }

  // Calculate stats
  const total = todos.length;
  const activeCount = todos.filter(t => !t.completed).length;
  const completedCount = todos.filter(t => t.completed).length;

  console.log("\n📊 Stats:");
  console.log(`   Total: ${total}`);
  console.log(`   Active: ${activeCount}`);
  console.log(`   Completed: ${completedCount}`);
  console.log(`   Computed totalCount: ${computed["computed.totalCount"] ?? "N/A"}`);
  console.log(`   Computed hasTodos: ${computed["computed.hasTodos"] ?? "N/A"}`);

  console.log("\n🔧 System:");
  console.log(`   Filter: ${data.filter ?? "all"}`);
  console.log(`   Status: ${data.status ?? snapshot?.system?.status ?? "idle"}`);
  console.log(`   Version: ${snapshot?.meta?.version ?? "N/A"}`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("🏗️  Todo Example - MEL + Compiler + Host + Effect-Utils");
  console.log("=".repeat(60));

  // -------------------------------------------------------------------------
  // Step 1: Load and compile MEL source
  // -------------------------------------------------------------------------
  console.log("\n📖 Step 1: Compiling MEL source...");

  const melPath = join(__dirname, "todo.mel");
  const melSource = readFileSync(melPath, "utf-8");

  console.log(`   Source file: ${melPath}`);
  console.log(`   Source size: ${melSource.length} bytes`);

  const compileResult = compile(melSource);

  if (!compileResult.success) {
    console.error("\n❌ Compilation failed:");
    compileResult.errors.forEach((err) => {
      console.error(`   [${err.code}] ${err.message}`);
      if (err.location) {
        console.error(`      at line ${err.location.start.line}:${err.location.start.column}`);
      }
    });
    process.exit(1);
  }

  const schema = compileResult.schema;
  console.log(`\n✅ Compilation successful!`);
  console.log(`   Domain: ${schema.id}`);
  console.log(`   Version: ${schema.version}`);
  console.log(`   Schema Hash: ${schema.hash.slice(0, 16)}...`);
  console.log(`   State fields: ${Object.keys(schema.state.fields).length}`);
  console.log(`   Computed fields: ${Object.keys(schema.computed.fields).length}`);
  console.log(`   Actions: ${Object.keys(schema.actions).length}`);

  // -------------------------------------------------------------------------
  // Step 2: Create Host with compiled schema
  // -------------------------------------------------------------------------
  console.log("\n⚙️  Step 2: Creating Host...");

  const host = createHost(schema, {
    initialData: {},
  });

  console.log("   Host created successfully");

  // -------------------------------------------------------------------------
  // Step 3: Register effect handlers
  // -------------------------------------------------------------------------
  console.log("\n🔌 Step 3: Registering effect handlers...");

  registerTodoHandlers(host);

  // Seed some initial data
  seedTodos();
  console.log("   Seeded 3 initial todos");

  // -------------------------------------------------------------------------
  // Step 4: Run example scenarios
  // -------------------------------------------------------------------------
  console.log("\n🎬 Step 4: Running scenarios...");

  // Initialize Host
  await host.dispatch(createIntent("__init__", {}));

  // Scenario 1: Load todos
  console.log("\n--- Scenario 1: Load todos ---");
  let result = await runIntent(host, "loadTodos");
  printSnapshotFromResult(result, "After loadTodos");

  // Scenario 2: Add a new todo
  console.log("\n--- Scenario 2: Add new todo ---");
  result = await runIntent(host, "addTodo", { title: "Test effect-utils integration" });
  printSnapshotFromResult(result, "After addTodo");

  // Scenario 3: Toggle a todo
  console.log("\n--- Scenario 3: Toggle todo ---");
  const snapshot = result.snapshot as { data?: { todos?: Array<{ id: string }> } };
  const todos = snapshot?.data?.todos || [];
  if (todos.length > 0) {
    const lastTodo = todos[todos.length - 1];
    result = await runIntent(host, "toggleTodo", { id: lastTodo.id });
    printSnapshotFromResult(result, "After toggleTodo");
  } else {
    console.log("   No todos to toggle");
  }

  // Scenario 4: Set filter
  console.log("\n--- Scenario 4: Set filter ---");
  result = await runIntent(host, "setFilter", { newFilter: "active" });
  printSnapshotFromResult(result, "After setFilter");

  // Scenario 5: Add more todos and save
  console.log("\n--- Scenario 5: Add more and save ---");
  result = await runIntent(host, "addTodo", { title: "Write documentation" });
  result = await runIntent(host, "addTodo", { title: "Deploy to production" });
  result = await runIntent(host, "saveTodos");
  printSnapshotFromResult(result, "After saveTodos");

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log("✨ Example completed successfully!");
  console.log("=".repeat(60));
  console.log("\nKey takeaways:");
  console.log("  1. MEL source compiled to DomainSchema");
  console.log("  2. Host executed intents using the schema");
  console.log("  3. Effect handlers used effect-utils for validation & resilience");
  console.log("  4. State changes tracked via Snapshot");
  console.log("\nPackages used:");
  console.log("  - @manifesto-ai/compiler (MEL → Schema)");
  console.log("  - @manifesto-ai/host (Intent execution)");
  console.log("  - @manifesto-ai/effect-utils (Effect handler utilities)");
  console.log("  - @manifesto-ai/core (Types & core functions)");
}

main().catch((err) => {
  console.error("\n💥 Error:", err);
  process.exit(1);
});
