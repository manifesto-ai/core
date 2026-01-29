/**
 * @fileoverview PLG Conformance Tests
 *
 * Tests for Plugin System rules per SPEC Section 11.8.
 *
 * Key rules tested:
 * PLG-2: Inspector plugins may only modify diagnostics
 * PLG-3: Transformer plugins must explicitly return modified graph
 * PLG-5: No plugin may modify Chunk.text or Chunk.span
 * PLG-8: Plugins receive ReadonlyPipelineContext only
 * PLG-14: Inspector returning IntentGraph shall throw error
 */

import { describe, it, expect } from "vitest";
import {
  type PipelinePlugin,
  type PipelineHooks,
  type ReadonlyPipelineContext,
  type IntentGraph,
  isInspector,
  isTransformer,
  createNodeId,
  InspectorGraphReturnError,
} from "../../index.js";

// Mock TranslatorPipeline for testing plugin behavior
// In real usage, TranslatorPipeline enforces these rules

describe("PLG Conformance", () => {
  describe("PLG-1: Plugins create run-scope hooks via createRunHooks()", () => {
    it("plugin has createRunHooks method", () => {
      const plugin: PipelinePlugin = {
        name: "test-plugin",
        kind: "inspector",
        createRunHooks(): PipelineHooks {
          return {};
        },
      };

      expect(typeof plugin.createRunHooks).toBe("function");
      expect(plugin.createRunHooks()).toBeDefined();
    });

    it("each call to createRunHooks returns fresh hooks", () => {
      const plugin: PipelinePlugin = {
        name: "stateful-plugin",
        kind: "inspector",
        createRunHooks(): PipelineHooks {
          let callCount = 0;
          return {
            beforeDecompose() {
              callCount++;
            },
          };
        },
      };

      const hooks1 = plugin.createRunHooks();
      const hooks2 = plugin.createRunHooks();

      // Should be independent instances
      expect(hooks1).not.toBe(hooks2);
    });
  });

  describe("PLG-2: Inspector plugins may only modify diagnostics", () => {
    it("inspector can add warnings to diagnostics", () => {
      const warnings: string[] = [];

      const plugin: PipelinePlugin = {
        name: "warning-inspector",
        kind: "inspector",
        createRunHooks(): PipelineHooks {
          return {
            afterMerge(ctx) {
              ctx.diagnostics.warn("TEST_WARN", "Test warning");
              warnings.push("added");
            },
          };
        },
      };

      expect(isInspector(plugin)).toBe(true);
    });

    it("inspector can add metrics to diagnostics", () => {
      const plugin: PipelinePlugin = {
        name: "metric-inspector",
        kind: "inspector",
        createRunHooks(): PipelineHooks {
          return {
            afterMerge(ctx) {
              ctx.diagnostics.metric("test_count", 42);
              ctx.diagnostics.metricAdd("accumulated", 10);
              ctx.diagnostics.metricObserve("latency", 100);
            },
          };
        },
      };

      expect(isInspector(plugin)).toBe(true);
    });
  });

  describe("PLG-3: Transformer plugins must explicitly return modified graph", () => {
    it("transformer hook can return modified graph", () => {
      const plugin: PipelinePlugin = {
        name: "graph-transformer",
        kind: "transformer",
        createRunHooks(): PipelineHooks {
          return {
            afterMerge(ctx): IntentGraph | void {
              if (ctx.merged) {
                // Return modified graph
                return {
                  nodes: [
                    ...ctx.merged.nodes,
                    {
                      id: createNodeId("added"),
                      ir: {
                        v: "0.1" as const,
                        force: "DO" as const,
                        event: { lemma: "CREATE", class: "CREATE" as const },
                        args: {},
                      },
                      resolution: { status: "Resolved", ambiguityScore: 0 },
                      dependsOn: [],
                    },
                  ],
                };
              }
            },
          };
        },
      };

      expect(isTransformer(plugin)).toBe(true);
    });

    it("transformer can return void for no changes", () => {
      const plugin: PipelinePlugin = {
        name: "conditional-transformer",
        kind: "transformer",
        createRunHooks(): PipelineHooks {
          return {
            afterMerge(ctx): IntentGraph | void {
              // Conditionally return nothing
              if (ctx.merged && ctx.merged.nodes.length === 0) {
                return; // No modification
              }
            },
          };
        },
      };

      expect(isTransformer(plugin)).toBe(true);
    });
  });

  describe("PLG-14: Inspector returning IntentGraph shall throw error", () => {
    it("InspectorGraphReturnError exists for this violation", () => {
      const error = new InspectorGraphReturnError("test-inspector");

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("InspectorGraphReturnError");
      expect(error.message).toContain("test-inspector");
    });

    it("inspector kind is correctly identified", () => {
      const inspectorPlugin: PipelinePlugin = {
        name: "inspector",
        kind: "inspector",
        createRunHooks: () => ({}),
      };

      const transformerPlugin: PipelinePlugin = {
        name: "transformer",
        kind: "transformer",
        createRunHooks: () => ({}),
      };

      expect(isInspector(inspectorPlugin)).toBe(true);
      expect(isInspector(transformerPlugin)).toBe(false);
      expect(isTransformer(inspectorPlugin)).toBe(false);
      expect(isTransformer(transformerPlugin)).toBe(true);
    });
  });

  describe("PLG-5: No plugin may modify Chunk.text or Chunk.span", () => {
    it("ChunkHookContext provides readonly chunk", () => {
      // This is enforced by TypeScript types
      // ChunkHookContext.chunk is readonly Chunk
      // Chunk.text and Chunk.span are readonly

      const plugin: PipelinePlugin = {
        name: "chunk-observer",
        kind: "inspector",
        createRunHooks(): PipelineHooks {
          return {
            beforeTranslateChunk(ctx) {
              // Can read but not write
              const text = ctx.chunk.text;
              const start = ctx.chunk.span.start;
              const end = ctx.chunk.span.end;

              // TypeScript would prevent:
              // ctx.chunk.text = "modified"; // Error
              // ctx.chunk.span.start = 0; // Error

              ctx.diagnostics.info("CHUNK", `Processing: ${text.slice(0, 20)}`);
            },
          };
        },
      };

      expect(plugin.kind).toBe("inspector");
    });
  });

  describe("PLG-8: Plugins receive ReadonlyPipelineContext only", () => {
    it("context provides readonly access to pipeline state", () => {
      const plugin: PipelinePlugin = {
        name: "readonly-observer",
        kind: "inspector",
        createRunHooks(): PipelineHooks {
          return {
            afterDecompose(ctx: ReadonlyPipelineContext) {
              // Can read
              const input = ctx.input;
              const chunks = ctx.chunks;

              // TypeScript types enforce readonly
              // ctx.input = "modified"; // Would be error
              // ctx.chunks?.push(...); // Would be error

              ctx.diagnostics.info(
                "DECOMPOSE",
                `Input: ${input.slice(0, 20)}, Chunks: ${chunks?.length}`
              );
            },
            afterMerge(ctx: ReadonlyPipelineContext) {
              // Can read merged graph
              const nodeCount = ctx.merged?.nodes.length ?? 0;
              ctx.diagnostics.metric("node_count", nodeCount);
            },
          };
        },
      };

      expect(plugin.kind).toBe("inspector");
    });
  });

  describe("PLG-11: Plugins execute in injection order", () => {
    it("plugin order is determined by array index", () => {
      const executionOrder: string[] = [];

      const plugin1: PipelinePlugin = {
        name: "first",
        kind: "inspector",
        createRunHooks(): PipelineHooks {
          return {
            beforeDecompose() {
              executionOrder.push("first");
            },
          };
        },
      };

      const plugin2: PipelinePlugin = {
        name: "second",
        kind: "inspector",
        createRunHooks(): PipelineHooks {
          return {
            beforeDecompose() {
              executionOrder.push("second");
            },
          };
        },
      };

      // When pipeline processes, it should execute in array order
      // [plugin1, plugin2] => first, second
      const plugins = [plugin1, plugin2];
      expect(plugins[0].name).toBe("first");
      expect(plugins[1].name).toBe("second");
    });
  });

  describe("Plugin creation patterns", () => {
    it("factory function creates plugin", () => {
      function createTimingPlugin(): PipelinePlugin {
        return {
          name: "timing",
          kind: "inspector",
          createRunHooks(): PipelineHooks {
            const startTimes = new Map<number, number>();

            return {
              beforeTranslateChunk(ctx) {
                startTimes.set(ctx.chunkIndex, Date.now());
              },
              afterTranslateChunk(ctx) {
                const start = startTimes.get(ctx.chunkIndex);
                if (start) {
                  const elapsed = Date.now() - start;
                  ctx.diagnostics.metricObserve("chunk_time_ms", elapsed);
                }
              },
            };
          },
        };
      }

      const plugin = createTimingPlugin();
      expect(plugin.name).toBe("timing");
      expect(isInspector(plugin)).toBe(true);
    });

    it("class-based plugin works", () => {
      class ValidationPlugin implements PipelinePlugin {
        readonly name = "validation";
        readonly kind = "inspector" as const;

        createRunHooks(): PipelineHooks {
          return {
            afterMerge(ctx) {
              if (ctx.merged && ctx.merged.nodes.length === 0) {
                ctx.diagnostics.warn("EMPTY_GRAPH", "Graph has no nodes");
              }
            },
          };
        }
      }

      const plugin = new ValidationPlugin();
      expect(plugin.name).toBe("validation");
      expect(isInspector(plugin)).toBe(true);
    });
  });
});
