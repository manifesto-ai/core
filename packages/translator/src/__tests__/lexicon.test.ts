/**
 * @fileoverview Lexicon Module Tests
 *
 * Tests for builtin, project, learned, and composite lexicons.
 */

import { describe, it, expect } from "vitest";
import {
  createBuiltinLexicon,
  deriveProjectLexicon,
  createLearnedLexicon,
  createCompositeLexicon,
  determineLexiconSource,
} from "../lexicon/index.js";
import type { DomainSchemaLike } from "../lexicon/project.js";
import type { LearnedEntry, LearnedAliasEntry } from "../types/index.js";

// =============================================================================
// Builtin Lexicon Tests
// =============================================================================

describe("Builtin Lexicon", () => {
  const builtin = createBuiltinLexicon();

  describe("resolveEvent", () => {
    it("should resolve DEFINE_TYPE", () => {
      const entry = builtin.resolveEvent("DEFINE_TYPE");
      expect(entry).toBeDefined();
      expect(entry?.eventClass).toBe("CREATE");
      expect(entry?.thetaFrame.required).toContain("TARGET");
    });

    it("should resolve ADD_FIELD", () => {
      const entry = builtin.resolveEvent("ADD_FIELD");
      expect(entry).toBeDefined();
      expect(entry?.eventClass).toBe("TRANSFORM");
    });

    it("should resolve ADD_CONSTRAINT", () => {
      const entry = builtin.resolveEvent("ADD_CONSTRAINT");
      expect(entry).toBeDefined();
      expect(entry?.eventClass).toBe("TRANSFORM");
    });

    it("should resolve SET_DEFAULT", () => {
      const entry = builtin.resolveEvent("SET_DEFAULT");
      expect(entry).toBeDefined();
      expect(entry?.eventClass).toBe("TRANSFORM");
    });

    it("should resolve ADD_COMPUTED", () => {
      const entry = builtin.resolveEvent("ADD_COMPUTED");
      expect(entry).toBeDefined();
      expect(entry?.eventClass).toBe("CREATE");
    });

    it("should resolve ADD_ACTION", () => {
      const entry = builtin.resolveEvent("ADD_ACTION");
      expect(entry).toBeDefined();
      expect(entry?.eventClass).toBe("CREATE");
    });

    it("should resolve ADD_ACTION_PARAM", () => {
      const entry = builtin.resolveEvent("ADD_ACTION_PARAM");
      expect(entry).toBeDefined();
    });

    it("should resolve ADD_ACTION_GUARD", () => {
      const entry = builtin.resolveEvent("ADD_ACTION_GUARD");
      expect(entry).toBeDefined();
    });

    it("should resolve ADD_ACTION_EFFECT", () => {
      const entry = builtin.resolveEvent("ADD_ACTION_EFFECT");
      expect(entry).toBeDefined();
    });

    it("should return undefined for unknown lemma", () => {
      const entry = builtin.resolveEvent("UNKNOWN_LEMMA");
      expect(entry).toBeUndefined();
    });
  });

  describe("resolveActionType", () => {
    it("should resolve builtin lemmas to action types", () => {
      expect(builtin.resolveActionType("DEFINE_TYPE")).toBe("DEFINE_TYPE");
      expect(builtin.resolveActionType("ADD_FIELD")).toBe("ADD_FIELD");
      expect(builtin.resolveActionType("ADD_ACTION")).toBe("ADD_ACTION");
    });

    it("should return undefined for unknown lemma", () => {
      expect(builtin.resolveActionType("UNKNOWN")).toBeUndefined();
    });
  });

  describe("mapArgsToInput", () => {
    it("should map args to input", () => {
      const args = {
        TARGET: { kind: "value" as const, valueType: "string" as const, shape: { name: "User" } },
      };

      const input = builtin.mapArgsToInput(args);
      expect(input).toBeDefined();
    });
  });
});

// =============================================================================
// Project Lexicon Tests
// =============================================================================

describe("Project Lexicon", () => {
  const mockSchema: DomainSchemaLike = {
    id: "test-schema",
    version: "1.0.0",
    hash: "test-hash",
    actions: {
      createUser: {
        flow: {},
        input: {
          type: "object",
          fields: {
            name: { type: "string" },
            email: { type: "string" },
          },
          required: ["name"],
        },
        description: "Create a new user",
      },
      updateUser: {
        flow: {},
        input: {
          type: "object",
          fields: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
      },
      getUser: {
        flow: {},
      },
      deleteUser: {
        flow: {},
      },
      cancelOrder: {
        flow: {},
      },
    },
  };

  it("should derive lexicon from schema", () => {
    const project = deriveProjectLexicon(mockSchema);

    expect(project.resolveEvent("CREATEUSER")).toBeDefined();
    expect(project.resolveEvent("UPDATEUSER")).toBeDefined();
    expect(project.resolveEvent("GETUSER")).toBeDefined();
  });

  it("should infer event class from action name", () => {
    const project = deriveProjectLexicon(mockSchema);

    // CREATE patterns
    const createEntry = project.resolveEvent("CREATEUSER");
    expect(createEntry?.eventClass).toBe("CREATE");

    // OBSERVE patterns
    const getEntry = project.resolveEvent("GETUSER");
    expect(getEntry?.eventClass).toBe("OBSERVE");

    // CONTROL patterns
    const cancelEntry = project.resolveEvent("CANCELORDER");
    expect(cancelEntry?.eventClass).toBe("CONTROL");
  });

  it("should derive theta frame from input fields", () => {
    const project = deriveProjectLexicon(mockSchema);

    const createEntry = project.resolveEvent("CREATEUSER");
    expect(createEntry?.thetaFrame).toBeDefined();
  });

  it("should resolve action types", () => {
    const project = deriveProjectLexicon(mockSchema);

    expect(project.resolveActionType("CREATEUSER")).toBe("createUser");
    expect(project.resolveActionType("UPDATEUSER")).toBe("updateUser");
  });

  it("should handle null schema", () => {
    const project = deriveProjectLexicon(null);

    expect(project.resolveEvent("ANYLEMMA")).toBeUndefined();
  });

  it("should handle empty schema", () => {
    const emptySchema: DomainSchemaLike = {
      id: "empty",
      version: "1.0.0",
      hash: "empty-hash",
      actions: {},
    };

    const project = deriveProjectLexicon(emptySchema);
    expect(project.resolveEvent("ANYLEMMA")).toBeUndefined();
  });
});

// =============================================================================
// Learned Lexicon Tests
// =============================================================================

describe("Learned Lexicon", () => {
  const builtin = createBuiltinLexicon();

  it("should create empty learned lexicon", () => {
    const learned = createLearnedLexicon({}, builtin);

    expect(learned.resolveEvent("UNKNOWN")).toBeUndefined();
  });

  it("should resolve alias entry to base lemma", () => {
    const entries: Record<string, LearnedEntry> = {
      CREATE_USER: {
        kind: "alias",
        lemma: "CREATE_USER",
        targetLemma: "DEFINE_TYPE",
        learnedAt: new Date().toISOString(),
        learnedFrom: "test",
      },
    };

    const learned = createLearnedLexicon(entries, builtin);

    // Should find the learned entry
    const entry = learned.resolveEvent("CREATE_USER");
    expect(entry).toBeDefined();
  });

  it("should resolve action type through alias", () => {
    const entries: Record<string, LearnedEntry> = {
      MY_CUSTOM_ACTION: {
        kind: "alias",
        lemma: "MY_CUSTOM_ACTION",
        targetLemma: "DEFINE_TYPE",
        learnedAt: new Date().toISOString(),
        learnedFrom: "test",
      },
    };

    const learned = createLearnedLexicon(entries, builtin);

    const actionType = learned.resolveActionType("MY_CUSTOM_ACTION");
    expect(actionType).toBe("DEFINE_TYPE");
  });

  it("should handle multiple entries", () => {
    const entries: Record<string, LearnedEntry> = {
      ALIAS_ONE: {
        kind: "alias",
        lemma: "ALIAS_ONE",
        targetLemma: "DEFINE_TYPE",
        learnedAt: new Date().toISOString(),
        learnedFrom: "test",
      },
      ALIAS_TWO: {
        kind: "alias",
        lemma: "ALIAS_TWO",
        targetLemma: "ADD_FIELD",
        learnedAt: new Date().toISOString(),
        learnedFrom: "test",
      },
    };

    const learned = createLearnedLexicon(entries, builtin);

    expect(learned.resolveEvent("ALIAS_ONE")).toBeDefined();
    expect(learned.resolveEvent("ALIAS_TWO")).toBeDefined();
  });
});

// =============================================================================
// Composite Lexicon Tests
// =============================================================================

describe("Composite Lexicon", () => {
  const builtin = createBuiltinLexicon();

  it("should create composite from layers", () => {
    const learned = createLearnedLexicon({}, builtin);
    const composite = createCompositeLexicon(learned, builtin, builtin);

    expect(composite).toBeDefined();
  });

  it("should resolve from builtin layer", () => {
    const learned = createLearnedLexicon({}, builtin);
    const composite = createCompositeLexicon(learned, builtin, builtin);

    const entry = composite.resolveEvent("DEFINE_TYPE");
    expect(entry).toBeDefined();
  });

  it("should prioritize learned over builtin", () => {
    const entries: Record<string, LearnedEntry> = {
      DEFINE_TYPE: {
        kind: "alias",
        lemma: "DEFINE_TYPE",
        targetLemma: "ADD_ACTION", // Override builtin
        learnedAt: new Date().toISOString(),
        learnedFrom: "test",
      },
    };

    const learned = createLearnedLexicon(entries, builtin);
    const composite = createCompositeLexicon(learned, builtin, builtin);

    // Should resolve through learned layer
    const actionType = composite.resolveActionType("DEFINE_TYPE");
    expect(actionType).toBe("ADD_ACTION");
  });
});

// =============================================================================
// Lexicon Source Determination Tests
// =============================================================================

describe("determineLexiconSource", () => {
  const builtin = createBuiltinLexicon();

  it("should return 'builtin' for builtin lemmas", () => {
    const learned = createLearnedLexicon({}, builtin);
    const project = deriveProjectLexicon(null);

    const source = determineLexiconSource(learned, project, builtin, "DEFINE_TYPE");
    expect(source).toBe("builtin");
  });

  it("should return 'learned' for learned lemmas", () => {
    const entries: Record<string, LearnedEntry> = {
      MY_LEMMA: {
        kind: "alias",
        lemma: "MY_LEMMA",
        targetLemma: "DEFINE_TYPE",
        learnedAt: new Date().toISOString(),
        learnedFrom: "test",
      },
    };

    const learned = createLearnedLexicon(entries, builtin);
    const project = deriveProjectLexicon(null);

    const source = determineLexiconSource(learned, project, builtin, "MY_LEMMA");
    expect(source).toBe("learned");
  });

  it("should return 'project' for project lemmas", () => {
    const learned = createLearnedLexicon({}, builtin);
    const project = deriveProjectLexicon({
      id: "test",
      version: "1.0.0",
      hash: "hash",
      actions: {
        myAction: { flow: {} },
      },
    });

    const source = determineLexiconSource(learned, project, builtin, "MYACTION");
    expect(source).toBe("project");
  });

  it("should return undefined for unknown lemma", () => {
    const learned = createLearnedLexicon({}, builtin);
    const project = deriveProjectLexicon(null);

    const source = determineLexiconSource(learned, project, builtin, "UNKNOWN");
    expect(source).toBeUndefined();
  });
});
