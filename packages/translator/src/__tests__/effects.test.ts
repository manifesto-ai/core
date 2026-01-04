/**
 * Effect Handlers Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createSnapshot } from "@manifesto-ai/core";
import {
  createTranslatorEffectHandlers,
  registerTranslatorEffects,
  type TranslatorEffectDependencies,
  type TranslatorEffectContext,
  type TranslatorEffectRegistry,
} from "../effects/index.js";
import type { DomainSchema, TranslatorConfig } from "../domain/index.js";
import { createConfig } from "../domain/config.js";

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestSchema(): DomainSchema {
  return {
    id: "test-world",
    version: "1.0.0",
    hash: "test-hash",
    state: {
      users: { type: { kind: "array", element: { kind: "primitive", name: "string" } } },
    },
    computed: {},
    actions: {},
    types: {},
  };
}

function createTestConfig(overrides?: Partial<TranslatorConfig>): TranslatorConfig {
  return createConfig({
    fastPathOnly: true, // Use fast path only for testing
    fastPathEnabled: true,
    retrievalTier: 0,
    slmModel: "gpt-4o-mini",
    ...overrides,
  });
}

function createTestDeps(overrides?: Partial<TranslatorEffectDependencies>): TranslatorEffectDependencies {
  return {
    config: createTestConfig(),
    schema: createTestSchema(),
    worldId: "test-world",
    ...overrides,
  };
}

function createTestSnapshot(data: Record<string, unknown> = {}): ReturnType<typeof createSnapshot> {
  return createSnapshot(
    {
      status: "idle",
      input: null,
      atWorldId: "test-world",
      schemaHash: "test-hash",
      intentId: "test-intent",
      chunksJson: null,
      normalizationJson: null,
      fastPathJson: null,
      retrievalJson: null,
      memoryJson: null,
      proposalJson: null,
      fragmentsJson: null,
      ambiguityReportJson: null,
      errorJson: null,
      ...data,
    },
    "test-schema-hash"
  );
}

function createTestContext(data: Record<string, unknown> = {}): TranslatorEffectContext {
  return {
    snapshot: createTestSnapshot(data),
    requirement: {
      id: "test-requirement",
      type: "translator.test",
      params: {},
      actionId: "translate",
      flowPosition: {
        nodePath: "translate",
        snapshotVersion: 0,
      },
      createdAt: Date.now(),
    },
  };
}

// =============================================================================
// createTranslatorEffectHandlers Tests
// =============================================================================

describe("createTranslatorEffectHandlers", () => {
  it("should create all required effect handlers", () => {
    const deps = createTestDeps();
    const handlers = createTranslatorEffectHandlers(deps);

    expect(handlers.has("translator.chunk")).toBe(true);
    expect(handlers.has("translator.normalize")).toBe(true);
    expect(handlers.has("translator.fastPath")).toBe(true);
    expect(handlers.has("translator.retrieve")).toBe(true);
    expect(handlers.has("translator.memory")).toBe(true);
    expect(handlers.has("translator.propose")).toBe(true);
    expect(handlers.has("translator.assemble")).toBe(true);
  });

  it("should return Map with 7 handlers", () => {
    const deps = createTestDeps();
    const handlers = createTranslatorEffectHandlers(deps);

    expect(handlers.size).toBe(7);
  });
});

// =============================================================================
// translator.chunk Handler Tests
// =============================================================================

describe("translator.chunk handler", () => {
  let handlers: Map<string, Function>;
  let deps: TranslatorEffectDependencies;

  beforeEach(() => {
    deps = createTestDeps();
    handlers = createTranslatorEffectHandlers(deps);
  });

  it("should chunk input and transition to normalizing", async () => {
    const handler = handlers.get("translator.chunk")!;
    const context = createTestContext({ status: "chunking" });

    const patches = await handler("translator.chunk", { input: "Add email field to user" }, context);

    expect(patches).toBeInstanceOf(Array);
    expect(patches.length).toBeGreaterThan(0);

    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch).toBeDefined();
    expect(statusPatch?.value).toBe("normalizing");

    const chunksPatch = patches.find((p: any) => p.path === "chunksJson");
    expect(chunksPatch).toBeDefined();
    expect(typeof chunksPatch?.value).toBe("string");
  });

  it("should use input from params if provided", async () => {
    const handler = handlers.get("translator.chunk")!;
    const context = createTestContext({ status: "chunking", input: "old input" });

    const patches = await handler("translator.chunk", { input: "new input" }, context);

    const chunksPatch = patches.find((p: any) => p.path === "chunksJson");
    const chunks = JSON.parse(chunksPatch?.value);
    expect(chunks[0].text).toBe("new input");
  });

  it("should handle empty input", async () => {
    const handler = handlers.get("translator.chunk")!;
    const context = createTestContext({ status: "chunking" });

    const patches = await handler("translator.chunk", { input: "" }, context);

    expect(patches).toBeInstanceOf(Array);
    // Should still transition to normalizing even with empty input
    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch?.value).toBe("normalizing");
  });
});

// =============================================================================
// translator.normalize Handler Tests
// =============================================================================

describe("translator.normalize handler", () => {
  let handlers: Map<string, Function>;
  let deps: TranslatorEffectDependencies;

  beforeEach(() => {
    deps = createTestDeps();
    handlers = createTranslatorEffectHandlers(deps);
  });

  it("should normalize input and transition to fast_path", async () => {
    const handler = handlers.get("translator.normalize")!;
    const context = createTestContext({ status: "normalizing", input: "Add email field" });

    const patches = await handler("translator.normalize", { input: "Add email field" }, context);

    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch?.value).toBe("fast_path");

    const normalizationPatch = patches.find((p: any) => p.path === "normalizationJson");
    expect(normalizationPatch).toBeDefined();

    const normalization = JSON.parse(normalizationPatch?.value);
    expect(normalization.canonical).toBeDefined();
    expect(normalization.language).toBeDefined();
  });

  it("should detect Korean language", async () => {
    const handler = handlers.get("translator.normalize")!;
    const context = createTestContext({ status: "normalizing" });

    const patches = await handler("translator.normalize", { input: "사용자에게 이메일 필드 추가" }, context);

    const normalizationPatch = patches.find((p: any) => p.path === "normalizationJson");
    const normalization = JSON.parse(normalizationPatch?.value);
    expect(normalization.language).toBe("ko");
  });
});

// =============================================================================
// translator.fastPath Handler Tests
// =============================================================================

describe("translator.fastPath handler", () => {
  let handlers: Map<string, Function>;
  let deps: TranslatorEffectDependencies;

  beforeEach(() => {
    deps = createTestDeps();
    handlers = createTranslatorEffectHandlers(deps);
  });

  it("should return error if normalization is missing", async () => {
    const handler = handlers.get("translator.fastPath")!;
    const context = createTestContext({ status: "fast_path" });

    const patches = await handler("translator.fastPath", {}, context);

    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch?.value).toBe("error");

    const errorPatch = patches.find((p: any) => p.path === "errorJson");
    const error = JSON.parse(errorPatch?.value);
    expect(error.code).toBe("FAST_PATH_ERROR");
    expect(error.message).toContain("Normalization result required");
  });

  it("should process fast path with normalization", async () => {
    const handler = handlers.get("translator.fastPath")!;
    const normalization = {
      canonical: "add email field to user",
      language: "en",
      tokens: [],
      glossaryHits: [],
    };
    const context = createTestContext({
      status: "fast_path",
      normalizationJson: JSON.stringify(normalization),
    });

    const patches = await handler("translator.fastPath", {}, context);

    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch).toBeDefined();
    // In fast-path-only mode with no match, should go to retrieval or assembling
    expect(["retrieval", "assembling"]).toContain(statusPatch?.value);

    const fastPathPatch = patches.find((p: any) => p.path === "fastPathJson");
    expect(fastPathPatch).toBeDefined();
  });

  it("should transition to assembling in fast-path-only mode when matched", async () => {
    deps = createTestDeps({ config: createTestConfig({ fastPathOnly: true }) });
    handlers = createTranslatorEffectHandlers(deps);

    const handler = handlers.get("translator.fastPath")!;
    const normalization = {
      canonical: "add email field to user",
      language: "en",
      tokens: [],
      glossaryHits: [],
    };
    const context = createTestContext({
      status: "fast_path",
      normalizationJson: JSON.stringify(normalization),
    });

    const patches = await handler("translator.fastPath", {}, context);

    const fastPathPatch = patches.find((p: any) => p.path === "fastPathJson");
    const fastPath = JSON.parse(fastPathPatch?.value);

    // If matched in fast-path-only mode, should go to assembling
    if (fastPath.matched) {
      const statusPatch = patches.find((p: any) => p.path === "status");
      expect(statusPatch?.value).toBe("assembling");
    }
  });
});

// =============================================================================
// translator.retrieve Handler Tests
// =============================================================================

describe("translator.retrieve handler", () => {
  let handlers: Map<string, Function>;
  let deps: TranslatorEffectDependencies;

  beforeEach(() => {
    deps = createTestDeps();
    handlers = createTranslatorEffectHandlers(deps);
  });

  it("should return error if normalization is missing", async () => {
    const handler = handlers.get("translator.retrieve")!;
    const context = createTestContext({ status: "retrieval" });

    const patches = await handler("translator.retrieve", {}, context);

    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch?.value).toBe("error");

    const errorPatch = patches.find((p: any) => p.path === "errorJson");
    const error = JSON.parse(errorPatch?.value);
    expect(error.code).toBe("RETRIEVAL_ERROR");
  });

  it("should retrieve and transition to memory", async () => {
    const handler = handlers.get("translator.retrieve")!;
    const normalization = {
      canonical: "add email field to user",
      language: "en",
      tokens: [],
      glossaryHits: [],
    };
    const context = createTestContext({
      status: "retrieval",
      normalizationJson: JSON.stringify(normalization),
    });

    const patches = await handler("translator.retrieve", {}, context);

    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch?.value).toBe("memory");

    const retrievalPatch = patches.find((p: any) => p.path === "retrievalJson");
    expect(retrievalPatch).toBeDefined();
  });
});

// =============================================================================
// translator.memory Handler Tests
// =============================================================================

describe("translator.memory handler", () => {
  let handlers: Map<string, Function>;
  let deps: TranslatorEffectDependencies;

  beforeEach(() => {
    deps = createTestDeps();
    handlers = createTranslatorEffectHandlers(deps);
  });

  it("should return error if retrieval is missing", async () => {
    const handler = handlers.get("translator.memory")!;
    const context = createTestContext({ status: "memory" });

    const patches = await handler("translator.memory", {}, context);

    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch?.value).toBe("error");

    const errorPatch = patches.find((p: any) => p.path === "errorJson");
    const error = JSON.parse(errorPatch?.value);
    expect(error.code).toBe("MEMORY_ERROR");
  });

  it("should process memory with graceful degradation", async () => {
    const handler = handlers.get("translator.memory")!;
    const retrieval = {
      tier: 0,
      candidates: [],
    };
    const context = createTestContext({
      status: "memory",
      retrievalJson: JSON.stringify(retrieval),
    });

    const patches = await handler("translator.memory", {}, context);

    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch?.value).toBe("proposing");

    const memoryPatch = patches.find((p: any) => p.path === "memoryJson");
    expect(memoryPatch).toBeDefined();

    const memory = JSON.parse(memoryPatch?.value);
    expect(memory.degraded).toBe(true); // No memory selector configured
  });
});

// =============================================================================
// translator.propose Handler Tests
// =============================================================================

describe("translator.propose handler", () => {
  let handlers: Map<string, Function>;
  let deps: TranslatorEffectDependencies;

  beforeEach(() => {
    deps = createTestDeps();
    handlers = createTranslatorEffectHandlers(deps);
  });

  it("should return error if previous stages are missing", async () => {
    const handler = handlers.get("translator.propose")!;
    const context = createTestContext({ status: "proposing" });

    const patches = await handler("translator.propose", {}, context);

    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch?.value).toBe("error");

    const errorPatch = patches.find((p: any) => p.path === "errorJson");
    const error = JSON.parse(errorPatch?.value);
    expect(error.code).toBe("PROPOSER_ERROR");
  });

  it("should process proposal with all prerequisites", async () => {
    const handler = handlers.get("translator.propose")!;
    const normalization = {
      canonical: "add email field to user",
      language: "en",
      tokens: [],
      glossaryHits: [],
    };
    const retrieval = { tier: 0, candidates: [] };
    const memory = {
      content: {
        translationExamples: [],
        schemaHistory: [],
        glossaryTerms: [],
        resolutionHistory: [],
      },
      selectedCount: 0,
      degraded: true,
    };
    const context = createTestContext({
      status: "proposing",
      normalizationJson: JSON.stringify(normalization),
      retrievalJson: JSON.stringify(retrieval),
      memoryJson: JSON.stringify(memory),
    });

    const patches = await handler("translator.propose", {}, context);

    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch).toBeDefined();
    // Could be assembling, error, or awaiting_resolution
    expect(["assembling", "error", "awaiting_resolution"]).toContain(statusPatch?.value);
  });
});

// =============================================================================
// translator.assemble Handler Tests
// =============================================================================

describe("translator.assemble handler", () => {
  let handlers: Map<string, Function>;
  let deps: TranslatorEffectDependencies;

  beforeEach(() => {
    deps = createTestDeps();
    handlers = createTranslatorEffectHandlers(deps);
  });

  it("should return error if no fragments available", async () => {
    const handler = handlers.get("translator.assemble")!;
    const context = createTestContext({ status: "assembling" });

    const patches = await handler("translator.assemble", {}, context);

    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch?.value).toBe("error");

    const errorPatch = patches.find((p: any) => p.path === "errorJson");
    const error = JSON.parse(errorPatch?.value);
    expect(error.code).toBe("ASSEMBLY_ERROR");
    expect(error.message).toContain("No fragments");
  });

  it("should assemble from proposal fragments", async () => {
    const handler = handlers.get("translator.assemble")!;
    const proposal = {
      kind: "fragments",
      fragments: [
        {
          fragmentId: "frag-1",
          intentId: "test-intent",
          op: { kind: "addField", path: "user.email", fieldType: { kind: "primitive", name: "string" } },
          confidence: 0.9,
        },
      ],
      confidence: 0.9,
      evidence: [],
    };
    const context = createTestContext({
      status: "assembling",
      proposalJson: JSON.stringify(proposal),
    });

    const patches = await handler("translator.assemble", {}, context);

    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch?.value).toBe("success");

    const fragmentsPatch = patches.find((p: any) => p.path === "fragmentsJson");
    expect(fragmentsPatch).toBeDefined();

    const completedAtPatch = patches.find((p: any) => p.path === "completedAt");
    expect(completedAtPatch).toBeDefined();
    expect(typeof completedAtPatch?.value).toBe("number");
  });

  it("should assemble from fast path best candidate", async () => {
    const handler = handlers.get("translator.assemble")!;
    const fastPath = {
      matched: true,
      best: {
        patternId: "test-pattern",
        fragments: [
          {
            fragmentId: "frag-2",
            intentId: "test-intent",
            op: { kind: "addField", path: "user.name", fieldType: { kind: "primitive", name: "string" } },
            confidence: 0.95,
          },
        ],
        confidence: 0.95,
      },
      candidates: [],
    };
    const context = createTestContext({
      status: "assembling",
      fastPathJson: JSON.stringify(fastPath),
    });

    const patches = await handler("translator.assemble", {}, context);

    const statusPatch = patches.find((p: any) => p.path === "status");
    expect(statusPatch?.value).toBe("success");

    const fragmentsPatch = patches.find((p: any) => p.path === "fragmentsJson");
    const fragments = JSON.parse(fragmentsPatch?.value);
    expect(fragments.length).toBe(1);
    expect(fragments[0].fragmentId).toBe("frag-2");
  });
});

// =============================================================================
// registerTranslatorEffects Tests
// =============================================================================

describe("registerTranslatorEffects", () => {
  it("should register all handlers with registry", () => {
    const deps = createTestDeps();
    const registered: string[] = [];

    const registry: TranslatorEffectRegistry = {
      register(type: string) {
        registered.push(type);
      },
      has() {
        return false;
      },
      get() {
        return undefined;
      },
    };

    registerTranslatorEffects(registry, deps);

    expect(registered).toContain("translator.chunk");
    expect(registered).toContain("translator.normalize");
    expect(registered).toContain("translator.fastPath");
    expect(registered).toContain("translator.retrieve");
    expect(registered).toContain("translator.memory");
    expect(registered).toContain("translator.propose");
    expect(registered).toContain("translator.assemble");
    expect(registered.length).toBe(7);
  });

  it("should not overwrite existing handlers", () => {
    const deps = createTestDeps();
    let registerCount = 0;

    const registry: TranslatorEffectRegistry = {
      register() {
        registerCount++;
      },
      has(type: string) {
        return type === "translator.chunk"; // Pretend chunk is already registered
      },
      get() {
        return undefined;
      },
    };

    registerTranslatorEffects(registry, deps);

    // Should register 6 handlers (not chunk)
    expect(registerCount).toBe(6);
  });
});
