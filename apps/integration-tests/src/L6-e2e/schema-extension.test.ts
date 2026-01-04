/**
 * L6: Schema Extension Scenario Tests
 *
 * Tests schema extension proposals from Translator.
 *
 * IMPORTANT: This documents the current architecture where:
 * - Translator can propose schema extensions (addField, addAction, etc.)
 * - These are PatchFragments with schema-level operations
 * - Currently, Host's processTranslatorOutput() SKIPS these operations
 * - Schema extension application is a planned future capability
 *
 * Per SPEC-1.1.1v, PatchOp v1 is strictly monotonic (add-only).
 * Operations: defineType, addField, addConstraint, setDefaultValue,
 *             widenFieldType, addComputed, addAction, addActionParam,
 *             addActionAvailable, addActionGuard
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createHost, type ManifestoHost } from "@manifesto-ai/host";
import {
  processTranslatorOutput,
  createTranslatorIntentId,
  type TranslatorOutput,
} from "@manifesto-ai/host";
import type { DomainSchema } from "@manifesto-ai/core";
import type { MelPatchFragment } from "@manifesto-ai/compiler";

// Import compiled schema
import CounterSchema from "../fixtures/schemas/counter-compiled.json";

const testSchema = CounterSchema as unknown as DomainSchema;

// =============================================================================
// Schema Extension Fragment Creators
// =============================================================================

function createAddFieldFragment(
  typeName: string,
  fieldName: string,
  fieldType: { kind: string; name?: string; element?: unknown },
  defaultValue: unknown,
  intentId: string
): MelPatchFragment {
  return {
    fragmentId: `frag-addfield-${Date.now()}`,
    sourceIntentId: intentId,
    op: {
      kind: "addField",
      typeName,
      field: {
        name: fieldName,
        type: fieldType,
        defaultValue,
      },
    },
    confidence: 0.95,
    evidence: [`User requested to add ${fieldName} field`],
    createdAt: new Date().toISOString(),
  };
}

function createAddComputedFragment(
  name: string,
  expr: { kind: string; [key: string]: unknown },
  intentId: string
): MelPatchFragment {
  return {
    fragmentId: `frag-addcomputed-${Date.now()}`,
    sourceIntentId: intentId,
    op: {
      kind: "addComputed",
      name,
      expr,
    },
    confidence: 0.9,
    evidence: [`User requested computed field ${name}`],
    createdAt: new Date().toISOString(),
  };
}

function createAddActionFragment(
  actionName: string,
  params: Record<string, { type: { kind: string }; optional: boolean }>,
  body: { blocks: any[] },
  intentId: string
): MelPatchFragment {
  return {
    fragmentId: `frag-addaction-${Date.now()}`,
    sourceIntentId: intentId,
    op: {
      kind: "addAction",
      actionName,
      params,
      body,
    },
    confidence: 0.85,
    evidence: [`User requested action ${actionName}`],
    createdAt: new Date().toISOString(),
  };
}

// =============================================================================
// L6: Schema Extension Scenarios
// =============================================================================

describe("L6: Schema Extension Scenarios", () => {
  let host: ManifestoHost;

  beforeEach(() => {
    host = createHost(testSchema, {
      initialData: { count: 0, lastIntent: null },
    });
  });

  describe("addField Proposals", () => {
    it("should generate addField fragment for 'add email field' request", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      // Simulated translator output for "add email field to user"
      const translatorOutput: TranslatorOutput = {
        fragments: [
          createAddFieldFragment(
            "State", // typeName
            "email", // fieldName
            { kind: "primitive", name: "string" },
            null,
            intentId
          ),
        ],
        actionName: "extendSchema",
      };

      const result = processTranslatorOutput(translatorOutput, snapshot!, {
        intentId,
      });

      // Currently, schema operations are SKIPPED in processTranslatorOutput
      // This is documented behavior - schema ops don't produce runtime patches
      expect(result.patches).toHaveLength(0);

      // But the lowered operations should still be present
      expect(result.lowered).toHaveLength(1);
      expect(result.lowered[0].op.kind).toBe("addField");
    });

    it("should handle addField with default value", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      const translatorOutput: TranslatorOutput = {
        fragments: [
          createAddFieldFragment(
            "State",
            "status",
            { kind: "primitive", name: "string" },
            "active",
            intentId
          ),
        ],
        actionName: "extendSchema",
      };

      const result = processTranslatorOutput(translatorOutput, snapshot!, {
        intentId,
      });

      expect(result.patches).toHaveLength(0); // Schema ops don't produce runtime patches
      expect(result.lowered[0].op.kind).toBe("addField");
    });

    it("should handle addField with complex type", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      // Add array field
      const translatorOutput: TranslatorOutput = {
        fragments: [
          createAddFieldFragment(
            "State",
            "tags",
            { kind: "array", element: { kind: "primitive", name: "string" } },
            [],
            intentId
          ),
        ],
        actionName: "extendSchema",
      };

      const result = processTranslatorOutput(translatorOutput, snapshot!, {
        intentId,
      });

      expect(result.patches).toHaveLength(0);
      expect(result.lowered[0].op.kind).toBe("addField");
    });
  });

  describe("addComputed Proposals", () => {
    /**
     * NOTE: addComputed requires correct expression format in lowering.
     * The test documents the expected fragment structure.
     */
    it("should recognize addComputed fragment structure", () => {
      const intentId = createTranslatorIntentId();
      const fragment = createAddComputedFragment(
        "countCopy",
        { kind: "get", path: ["count"] },
        intentId
      );

      expect(fragment.op.kind).toBe("addComputed");
      expect((fragment.op as any).name).toBe("countCopy");
      expect((fragment.op as any).expr.kind).toBe("get");
    });
  });

  describe("addAction Proposals", () => {
    /**
     * NOTE: addAction fragments with complex action bodies are not fully
     * supported in lowering yet. This test documents the expected behavior.
     */
    it.skip("should generate addAction fragment (complex body not yet supported)", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      // "add a multiply action"
      const translatorOutput: TranslatorOutput = {
        fragments: [
          createAddActionFragment(
            "multiply",
            {
              factor: { type: { kind: "number" }, optional: false },
            },
            {
              blocks: [
                {
                  guard: { guardKind: "when", condition: { kind: "lit", value: true } },
                  body: [
                    {
                      kind: "patch",
                      target: "count",
                      value: {
                        kind: "get",
                        path: "input.factor",
                      },
                    },
                  ],
                },
              ],
            },
            intentId
          ),
        ],
        actionName: "extendSchema",
      };

      const result = processTranslatorOutput(translatorOutput, snapshot!, {
        intentId,
      });

      expect(result.patches).toHaveLength(0);
      expect(result.lowered[0].op.kind).toBe("addAction");
    });

    it("should recognize addAction fragment structure", () => {
      const intentId = createTranslatorIntentId();
      const fragment = createAddActionFragment(
        "myAction",
        { param1: { type: { kind: "string" }, optional: false } },
        { blocks: [] },
        intentId
      );

      expect(fragment.op.kind).toBe("addAction");
      expect((fragment.op as any).actionName).toBe("myAction");
      expect((fragment.op as any).params).toHaveProperty("param1");
    });
  });

  describe("Mixed Schema + State Operations", () => {
    it("should handle mix of schema extension and state change", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      // "add email field and set initial value"
      const translatorOutput: TranslatorOutput = {
        fragments: [
          // Schema extension
          createAddFieldFragment("State", "email", { kind: "primitive", name: "string" }, null, intentId),
          // State change (setDefaultValue IS processed)
          {
            fragmentId: `frag-set-${Date.now()}`,
            sourceIntentId: intentId,
            op: {
              kind: "setDefaultValue",
              path: "count",
              value: { kind: "lit", value: 100 },
            },
            confidence: 1.0,
            evidence: ["Set initial count"],
            createdAt: new Date().toISOString(),
          },
        ],
        actionName: "extendAndSet",
      };

      const result = processTranslatorOutput(translatorOutput, snapshot!, {
        intentId,
      });

      // Schema op (addField) is skipped, state op (setDefaultValue) is processed
      expect(result.patches).toHaveLength(1);
      expect(result.patches[0].path).toBe("count");
      expect(result.patches[0].value).toBe(100);

      // Both are in lowered
      expect(result.lowered).toHaveLength(2);
    });
  });

  describe("World Fork with New Schema", () => {
    /**
     * Schema extension works by creating a NEW World with a different schemaHash.
     * The existing schema is immutable - we fork to a new schema instead.
     */
    it("should create world with different schema hash", async () => {
      const { createWorldFromExecution, generateProposalId } = await import("@manifesto-ai/world");
      const { createSnapshot } = await import("@manifesto-ai/core");

      // Original schema hash
      const originalSchemaHash = testSchema.hash;

      // Simulated new schema hash (after adding email field)
      const newSchemaHash = "new-schema-hash-with-email-field";

      // Create snapshot with new field's default value
      const hostContext = { now: Date.now(), randomSeed: "test", durationMs: 0 };
      const newSnapshot = createSnapshot(
        { count: 0, lastIntent: null, email: null }, // email field added
        newSchemaHash,
        hostContext
      );

      // Create world from execution with NEW schema
      const proposalId = generateProposalId();
      const newWorld = await createWorldFromExecution(
        newSchemaHash,  // Different schema!
        newSnapshot,
        proposalId
      );

      // Verify new world has different schema
      expect(newWorld.schemaHash).toBe(newSchemaHash);
      expect(newWorld.schemaHash).not.toBe(originalSchemaHash);
      expect(newWorld.createdBy).toBe(proposalId);
    });

    it("should compute different worldId for different schemas with same data", async () => {
      const { computeWorldId, computeSnapshotHash } = await import("@manifesto-ai/world");
      const { createSnapshot } = await import("@manifesto-ai/core");

      const hostContext = { now: Date.now(), randomSeed: "test", durationMs: 0 };
      const sameData = { count: 42, lastIntent: null };

      // Same snapshot data, different schemas
      const snapshotA = createSnapshot(sameData, "schema-a", hostContext);
      const snapshotB = createSnapshot(sameData, "schema-b", hostContext);

      const snapshotHashA = await computeSnapshotHash(snapshotA);
      const snapshotHashB = await computeSnapshotHash(snapshotB);

      // Snapshot hashes are same (same data)
      expect(snapshotHashA).toBe(snapshotHashB);

      // But worldIds are different (different schemaHash)
      const worldIdA = await computeWorldId("schema-a", snapshotHashA);
      const worldIdB = await computeWorldId("schema-b", snapshotHashB);

      expect(worldIdA).not.toBe(worldIdB);
    });
  });
});

// =============================================================================
// L6: Confidence-Based Filtering
// =============================================================================

describe("L6: Confidence-Based Fragment Filtering", () => {
  let host: ManifestoHost;

  beforeEach(() => {
    host = createHost(testSchema, {
      initialData: { count: 0, lastIntent: null },
    });
  });

  describe("Confidence Scores", () => {
    it("should preserve confidence scores in fragments", async () => {
      const intentId = createTranslatorIntentId();
      const snapshot = await host.getSnapshot();

      const highConfidence: MelPatchFragment = {
        fragmentId: "frag-high",
        sourceIntentId: intentId,
        op: { kind: "setDefaultValue", path: "count", value: { kind: "lit", value: 10 } },
        confidence: 0.95,
        evidence: ["Clear user intent"],
        createdAt: new Date().toISOString(),
      };

      const lowConfidence: MelPatchFragment = {
        fragmentId: "frag-low",
        sourceIntentId: intentId,
        op: { kind: "setDefaultValue", path: "lastIntent", value: { kind: "lit", value: "maybe" } },
        confidence: 0.4,
        evidence: ["Ambiguous request"],
        createdAt: new Date().toISOString(),
      };

      const translatorOutput: TranslatorOutput = {
        fragments: [highConfidence, lowConfidence],
        actionName: "test",
      };

      const result = processTranslatorOutput(translatorOutput, snapshot!, {
        intentId,
      });

      // Both fragments are processed (confidence filtering is done by Translator, not Host)
      expect(result.patches).toHaveLength(2);
    });

    it("should include evidence in fragments for auditability", () => {
      const intentId = createTranslatorIntentId();

      const fragment = createAddFieldFragment(
        "State",
        "email",
        { kind: "primitive", name: "string" },
        null,
        intentId
      );

      expect(fragment.evidence).toContain("User requested to add email field");
      expect(fragment.confidence).toBe(0.95);
    });
  });
});
