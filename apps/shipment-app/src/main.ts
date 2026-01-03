/**
 * Shipment App - GlobalOceanLogistics Demo
 *
 * Pipeline:
 *   shipment.mel → Compiler → Schema → Host → Mock Handlers
 *
 * Demonstrates 4 scenarios:
 *   1. refreshDashboard - Real-time tracking dashboard
 *   2. requestQuote - Instant freight quotes
 *   3. openBillOfLading - B/L document processing with OCR
 *   4. processDisruption - Port disruption management
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { compile } from "@manifesto-ai/compiler";
import { createHost, createIntent } from "@manifesto-ai/host";
import { registerMockHandlers } from "./mock-handlers.js";

// =============================================================================
// Helpers
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function printSection(title: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(70));
}

function printResult(snapshot: unknown, label: string) {
  console.log(`\n📸 ${label}`);
  console.log("-".repeat(50));

  const s = snapshot as {
    data?: Record<string, unknown>;
    computed?: Record<string, unknown>;
    system?: { status: string; pendingRequirements?: unknown[] };
    meta?: { version: number };
  };

  // Print relevant data keys
  const data = s?.data ?? {};
  const dataKeys = Object.keys(data).filter((k) => data[k] != null);

  if (dataKeys.length > 0) {
    console.log("\n📦 Data:");
    dataKeys.forEach((key) => {
      const value = data[key];
      if (typeof value === "object" && value !== null) {
        const count = Object.keys(value).length;
        console.log(`   ${key}: ${count} item(s)`);
      } else {
        console.log(`   ${key}: ${JSON.stringify(value)}`);
      }
    });
  }

  // Print computed summary
  const computed = s?.computed ?? {};
  const computedKeys = Object.keys(computed).filter((k) => computed[k] != null);
  if (computedKeys.length > 0) {
    console.log("\n📊 Computed:");
    computedKeys.slice(0, 5).forEach((key) => {
      const shortKey = key.replace("computed.", "");
      const value = computed[key];
      if (typeof value === "object" && value !== null) {
        const count = Array.isArray(value) ? value.length : Object.keys(value).length;
        console.log(`   ${shortKey}: ${count} item(s)`);
      } else {
        console.log(`   ${shortKey}: ${JSON.stringify(value)}`);
      }
    });
    if (computedKeys.length > 5) {
      console.log(`   ... and ${computedKeys.length - 5} more`);
    }
  }

  console.log("\n🔧 System:");
  console.log(`   Version: ${s?.meta?.version ?? 0}`);
  console.log(`   Status: ${s?.system?.status ?? "unknown"}`);
}

async function runIntent(
  host: Awaited<ReturnType<typeof createHost>>,
  action: string,
  input: Record<string, unknown> = {}
) {
  const inputStr = Object.keys(input).length > 0 ? JSON.stringify(input) : "";
  console.log(`\n🚀 ${action}(${inputStr})`);

  const intent = createIntent(action, input, createIntentId());
  const result = await host.dispatch(intent);

  if (result.status === "error") {
    console.error("   ❌ Error:", (result.snapshot as { system?: { lastError?: unknown } })?.system?.lastError);
  } else {
    console.log(`   ✅ ${result.status}`);
  }

  return result;
}

function createIntentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `intent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("🚢 Shipment App - GlobalOceanLogistics Demo");
  console.log("=".repeat(70));

  // -------------------------------------------------------------------------
  // Step 1: Compile MEL
  // -------------------------------------------------------------------------
  console.log("\n📖 Compiling shipment.mel...");

  const melPath = join(__dirname, "..", "shipment.mel");
  const melSource = readFileSync(melPath, "utf-8");

  const compileResult = compile(melSource);

  if (!compileResult.success) {
    console.error("\n❌ Compilation failed:");
    compileResult.errors.forEach((err) => {
      console.error(`   [${err.code}] ${err.message}`);
    });
    process.exit(1);
  }

  const schema = compileResult.schema;
  console.log(`✅ Compiled: ${schema.id} v${schema.version}`);
  console.log(`   State: ${Object.keys(schema.state.fields).length} fields`);
  console.log(`   Computed: ${Object.keys(schema.computed.fields).length} fields`);
  console.log(`   Actions: ${Object.keys(schema.actions).length}`);

  // -------------------------------------------------------------------------
  // Step 2: Create Host & Register Handlers
  // -------------------------------------------------------------------------
  console.log("\n⚙️  Creating Host...");

  const host = createHost(schema, { initialData: {} });
  registerMockHandlers(host);

  // Initialize
  await host.dispatch(createIntent("__init__", {}, createIntentId()));
  console.log("✅ Host initialized");

  // -------------------------------------------------------------------------
  // Scenario 1: Real-time Tracking Dashboard
  // -------------------------------------------------------------------------
  printSection("Scenario 1: Real-time Tracking Dashboard");
  console.log("Customer views their active shipments with live AIS/TOS/Weather signals.");

  let result = await runIntent(host, "refreshDashboard", { customerId: "customer-1" });
  printResult(result.snapshot, "Dashboard State");

  // -------------------------------------------------------------------------
  // Scenario 2: Instant Freight Quote
  // -------------------------------------------------------------------------
  printSection("Scenario 2: Instant Freight Quote");
  console.log("Request quotes from multiple carriers for KRPUS → USLAX route.");

  result = await runIntent(host, "requestQuote", {
    customerId: "customer-1",
    origin: "KRPUS",
    destination: "USLAX",
  });
  printResult(result.snapshot, "Quote State");

  // -------------------------------------------------------------------------
  // Scenario 3: B/L Document Processing
  // -------------------------------------------------------------------------
  printSection("Scenario 3: B/L Document Processing");
  console.log("Open Bill of Lading with OCR extraction and customs risk check.");

  result = await runIntent(host, "openBillOfLading", { orderId: "order-123" });
  printResult(result.snapshot, "Document State");

  // -------------------------------------------------------------------------
  // Scenario 4: Port Disruption Management
  // -------------------------------------------------------------------------
  printSection("Scenario 4: Port Disruption Management");
  console.log("Handle typhoon disruption at KRPUS - notify affected orders, find alternatives.");

  result = await runIntent(host, "processDisruption", {
    eventId: "typhoon-2024-01",
    portCode: "KRPUS",
    kind: "typhoon",
  });
  printResult(result.snapshot, "Disruption State");

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  printSection("Demo Complete");
  console.log(`
Key Points:
  • MEL compiled GlobalOceanLogistics domain (4 modules)
  • Host executed 4 real-world shipping scenarios
  • Mock handlers simulated external APIs (AIS, TOS, OCR, Carriers, etc.)
  • State changes tracked via immutable Snapshots

Architecture:
  shipment.mel ─→ @manifesto-ai/compiler ─→ Schema
                                              │
                                              v
  Mock APIs ←─ @manifesto-ai/host ←─────── Dispatch
                                              │
                                              v
                                          Snapshot
`);
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});
