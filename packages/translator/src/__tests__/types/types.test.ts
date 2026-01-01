/**
 * Type validation tests for Translator
 * TDD approach: tests written first
 */

import { describe, it, expect } from "vitest";
import type {
  // Common
  SemanticPath,
  LanguageCode,
  FallbackBehavior,
  // Token
  Token,
  // Glossary
  GlossaryEntry,
  GlossaryHit,
  // Type system
  TypeExpr,
  ResolvedType,
  TypeIndex,
  ExprNode,
  PathNode,
  // Fragment
  PatchFragment,
  FragmentChange,
  FragmentPatch,
  FragmentConstraint,
  FragmentAddField,
  FragmentRemoveField,
  FragmentAddComputed,
  FragmentAddType,
  FragmentSetFieldType,
  // Request
  TranslationRequest,
  TranslationOptions,
  // Normalization
  NormalizationResult,
  ProtectedSpan,
  // Fast path
  FastPathResult,
  FastPathPatternName,
  // Retrieval
  RetrievalResult,
  AnchorCandidate,
  RetrievalTier,
  MatchType,
  // Proposal
  ProposalResult,
  AmbiguityReport,
  ResolutionOption,
  ResolutionSelection,
  AmbiguityKind,
  // Result
  TranslationResult,
  TranslationResultFragment,
  TranslationResultAmbiguity,
  TranslationResultDiscarded,
  // State
  TranslatorState,
  PipelineStage,
} from "../../types/index.js";
import { DEFAULT_TRANSLATION_OPTIONS } from "../../types/index.js";

describe("Translator Types", () => {
  describe("Common Types", () => {
    it("SemanticPath is string", () => {
      const path: SemanticPath = "User.age";
      expect(typeof path).toBe("string");
    });

    it("LanguageCode is string", () => {
      const code: LanguageCode = "ko";
      expect(typeof code).toBe("string");
    });

    it("FallbackBehavior is guess or discard", () => {
      const guess: FallbackBehavior = "guess";
      const discard: FallbackBehavior = "discard";
      expect(guess).toBe("guess");
      expect(discard).toBe("discard");
    });
  });

  describe("Token", () => {
    it("has required fields", () => {
      const token: Token = {
        original: "age",
        normalized: "age",
        pos: "NOUN",
        start: 0,
        end: 3,
      };
      expect(token.original).toBe("age");
      expect(token.normalized).toBe("age");
      expect(token.pos).toBe("NOUN");
      expect(token.start).toBe(0);
      expect(token.end).toBe(3);
    });
  });

  describe("GlossaryEntry", () => {
    it("has required fields", () => {
      const entry: GlossaryEntry = {
        semanticId: "op.gte",
        canonical: "gte",
        aliases: {
          ko: ["이상", "크거나 같음"],
          en: ["at least", "greater than or equal"],
        },
      };
      expect(entry.semanticId).toBe("op.gte");
      expect(entry.canonical).toBe("gte");
      expect(entry.aliases.ko).toContain("이상");
    });

    it("has optional typeHint and anchorHints", () => {
      const entry: GlossaryEntry = {
        semanticId: "field.age",
        canonical: "age",
        aliases: { ko: ["나이"], en: ["age"] },
        typeHint: { kind: "primitive", name: "number" },
        anchorHints: ["User.age", "Profile.age"],
      };
      expect(entry.typeHint).toBeDefined();
      expect(entry.anchorHints).toHaveLength(2);
    });
  });

  describe("GlossaryHit", () => {
    it("has required fields", () => {
      const hit: GlossaryHit = {
        semanticId: "op.gte",
        canonical: "gte",
        matchedAlias: "이상",
        confidence: 0.95,
      };
      expect(hit.semanticId).toBe("op.gte");
      expect(hit.canonical).toBe("gte");
      expect(hit.matchedAlias).toBe("이상");
      expect(hit.confidence).toBeGreaterThanOrEqual(0);
      expect(hit.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("TypeExpr", () => {
    it("supports primitive kind", () => {
      const type: TypeExpr = { kind: "primitive", name: "string" };
      expect(type.kind).toBe("primitive");
    });

    it("supports literal kind", () => {
      const type: TypeExpr = { kind: "literal", value: "pending" };
      expect(type.kind).toBe("literal");
    });

    it("supports ref kind", () => {
      const type: TypeExpr = { kind: "ref", name: "User" };
      expect(type.kind).toBe("ref");
    });

    it("supports union kind", () => {
      const type: TypeExpr = {
        kind: "union",
        members: [
          { kind: "literal", value: "pending" },
          { kind: "literal", value: "active" },
        ],
      };
      expect(type.kind).toBe("union");
      expect(type.members).toHaveLength(2);
    });

    it("supports array kind", () => {
      const type: TypeExpr = {
        kind: "array",
        element: { kind: "primitive", name: "string" },
      };
      expect(type.kind).toBe("array");
    });

    it("supports record kind", () => {
      const type: TypeExpr = {
        kind: "record",
        key: { kind: "primitive", name: "string" },
        value: { kind: "primitive", name: "number" },
      };
      expect(type.kind).toBe("record");
    });

    it("supports object kind", () => {
      const type: TypeExpr = {
        kind: "object",
        fields: [
          { name: "name", type: { kind: "primitive", name: "string" }, optional: false },
          { name: "age", type: { kind: "primitive", name: "number" }, optional: true },
        ],
      };
      expect(type.kind).toBe("object");
      expect(type.fields).toHaveLength(2);
    });
  });

  describe("ResolvedType", () => {
    it("has required fields", () => {
      const resolved: ResolvedType = {
        resolved: { kind: "primitive", name: "number" },
        nullable: false,
        baseKind: "number",
      };
      expect(resolved.nullable).toBe(false);
      expect(resolved.baseKind).toBe("number");
    });

    it("has optional sourceName", () => {
      const resolved: ResolvedType = {
        resolved: { kind: "primitive", name: "string" },
        sourceName: "Email",
        nullable: true,
        baseKind: "string",
      };
      expect(resolved.sourceName).toBe("Email");
    });
  });

  describe("TypeIndex", () => {
    it("maps paths to resolved types", () => {
      const index: TypeIndex = {
        "User.age": {
          resolved: { kind: "primitive", name: "number" },
          nullable: false,
          baseKind: "number",
        },
        "User.name": {
          resolved: { kind: "primitive", name: "string" },
          nullable: false,
          baseKind: "string",
        },
      };
      expect(index["User.age"].baseKind).toBe("number");
      expect(index["User.name"].baseKind).toBe("string");
    });
  });

  describe("ExprNode", () => {
    it("supports lit kind", () => {
      const expr: ExprNode = { kind: "lit", value: 42 };
      expect(expr.kind).toBe("lit");
    });

    it("supports call kind", () => {
      const expr: ExprNode = {
        kind: "call",
        fn: "gte",
        args: [
          { kind: "get", path: { kind: "name", name: "age" } },
          { kind: "lit", value: 18 },
        ],
      };
      expect(expr.kind).toBe("call");
      expect(expr.fn).toBe("gte");
      expect(expr.args).toHaveLength(2);
    });

    it("supports obj kind", () => {
      const expr: ExprNode = {
        kind: "obj",
        fields: [{ key: "name", value: { kind: "lit", value: "test" } }],
      };
      expect(expr.kind).toBe("obj");
    });

    it("supports arr kind", () => {
      const expr: ExprNode = {
        kind: "arr",
        elements: [{ kind: "lit", value: 1 }, { kind: "lit", value: 2 }],
      };
      expect(expr.kind).toBe("arr");
    });
  });

  describe("PatchFragment", () => {
    it("has required fields", () => {
      const fragment: PatchFragment = {
        fragmentId: "frag-001",
        sourceIntentId: "intent-001",
        description: "Set User.age >= 18",
        change: {
          kind: "constraint",
          path: "User.age",
          expr: { kind: "call", fn: "gte", args: [] },
        },
        confidence: 1.0,
        evidence: ["나이가 18세 이상"],
      };
      expect(fragment.fragmentId).toBe("frag-001");
      expect(fragment.sourceIntentId).toBe("intent-001");
      expect(fragment.description).toContain("User.age");
      expect(fragment.confidence).toBe(1.0);
      expect(fragment.evidence).toHaveLength(1);
    });
  });

  describe("FragmentChange", () => {
    it("supports patch kind", () => {
      const change: FragmentPatch = {
        kind: "patch",
        path: "User.name",
        op: "set",
        value: { kind: "lit", value: "John" },
      };
      expect(change.kind).toBe("patch");
      expect(change.op).toBe("set");
    });

    it("supports constraint kind", () => {
      const change: FragmentConstraint = {
        kind: "constraint",
        path: "User.age",
        expr: { kind: "call", fn: "gte", args: [] },
        message: "Age must be >= 18",
      };
      expect(change.kind).toBe("constraint");
      expect(change.message).toBeDefined();
    });

    it("supports addField kind", () => {
      const change: FragmentAddField = {
        kind: "addField",
        path: "User.nickname",
        type: { kind: "primitive", name: "string" },
        default: "",
      };
      expect(change.kind).toBe("addField");
    });

    it("supports removeField kind", () => {
      const change: FragmentRemoveField = {
        kind: "removeField",
        path: "User.deprecated",
      };
      expect(change.kind).toBe("removeField");
    });

    it("supports addComputed kind", () => {
      const change: FragmentAddComputed = {
        kind: "addComputed",
        name: "isAdult",
        expr: { kind: "call", fn: "gte", args: [] },
        deps: ["User.age"],
      };
      expect(change.kind).toBe("addComputed");
    });

    it("supports addType kind", () => {
      const change: FragmentAddType = {
        kind: "addType",
        name: "Status",
        typeExpr: { kind: "union", members: [] },
        description: "Order status",
      };
      expect(change.kind).toBe("addType");
    });

    it("supports setFieldType kind", () => {
      const change: FragmentSetFieldType = {
        kind: "setFieldType",
        path: "User.age",
        typeExpr: { kind: "primitive", name: "number" },
      };
      expect(change.kind).toBe("setFieldType");
    });

    it("is a discriminated union", () => {
      const changes: FragmentChange[] = [
        { kind: "patch", path: "p", op: "set", value: { kind: "lit", value: 1 } },
        { kind: "constraint", path: "p", expr: { kind: "lit", value: true } },
        { kind: "addField", path: "p", type: { kind: "primitive", name: "string" } },
        { kind: "removeField", path: "p" },
        { kind: "addComputed", name: "c", expr: { kind: "lit", value: 1 }, deps: [] },
        { kind: "addType", name: "T", typeExpr: { kind: "primitive", name: "string" } },
        { kind: "setFieldType", path: "p", typeExpr: { kind: "primitive", name: "number" } },
      ];
      expect(changes).toHaveLength(7);
    });
  });

  describe("TranslationRequest", () => {
    it("has required fields", () => {
      const request: TranslationRequest = {
        input: "나이가 18세 이상이어야 해",
        targetSchemaId: "schema-001",
        intentId: "intent-001",
        options: null,
      };
      expect(request.input).toBeTruthy();
      expect(request.targetSchemaId).toBeTruthy();
      expect(request.intentId).toBeTruthy();
    });

    it("can have options", () => {
      const request: TranslationRequest = {
        input: "test",
        targetSchemaId: "schema-001",
        intentId: "intent-001",
        options: {
          language: "ko",
          maxCandidates: 10,
          timeoutMs: 60000,
          fallbackBehavior: "discard",
        },
      };
      expect(request.options?.language).toBe("ko");
      expect(request.options?.maxCandidates).toBe(10);
    });
  });

  describe("TranslationOptions", () => {
    it("has default values", () => {
      expect(DEFAULT_TRANSLATION_OPTIONS.language).toBeNull();
      expect(DEFAULT_TRANSLATION_OPTIONS.maxCandidates).toBe(5);
      expect(DEFAULT_TRANSLATION_OPTIONS.timeoutMs).toBe(300000);
      expect(DEFAULT_TRANSLATION_OPTIONS.fallbackBehavior).toBe("guess");
    });
  });

  describe("NormalizationResult", () => {
    it("has required fields", () => {
      const result: NormalizationResult = {
        canonical: "User.age gte 18",
        language: "ko",
        tokens: [{ text: "age", pos: "NOUN", lemma: "age", index: 0 }],
        glossaryHits: [{ semanticId: "op.gte", canonical: "gte", matchedAlias: "이상", confidence: 0.95 }],
        protected: [{ start: 0, end: 8, kind: "identifier", value: "User.age" }],
      };
      expect(result.canonical).toBeTruthy();
      expect(result.language).toBe("ko");
      expect(result.tokens).toHaveLength(1);
      expect(result.glossaryHits).toHaveLength(1);
      expect(result.protected).toHaveLength(1);
    });
  });

  describe("ProtectedSpan", () => {
    it("has valid kind values", () => {
      const spans: ProtectedSpan[] = [
        { start: 0, end: 8, kind: "identifier", value: "User.age" },
        { start: 10, end: 12, kind: "number", value: "18" },
        { start: 15, end: 22, kind: "literal", value: "pending" },
        { start: 25, end: 28, kind: "operator", value: "gte" },
      ];
      expect(spans.map(s => s.kind)).toEqual(["identifier", "number", "literal", "operator"]);
    });
  });

  describe("FastPathResult", () => {
    it("has matched false when no match", () => {
      const result: FastPathResult = {
        matched: false,
        pattern: null,
        fragment: null,
        confidence: 0.0,
      };
      expect(result.matched).toBe(false);
      expect(result.pattern).toBeNull();
      expect(result.fragment).toBeNull();
    });

    it("has matched true with pattern when match", () => {
      const result: FastPathResult = {
        matched: true,
        pattern: "comparator",
        fragment: {
          fragmentId: "frag-001",
          sourceIntentId: "intent-001",
          description: "test",
          change: { kind: "constraint", path: "User.age", expr: { kind: "lit", value: true } },
          confidence: 1.0,
          evidence: [],
        },
        confidence: 1.0,
      };
      expect(result.matched).toBe(true);
      expect(result.pattern).toBe("comparator");
      expect(result.fragment).toBeTruthy();
      expect(result.confidence).toBe(1.0);
    });

    it("has valid pattern names", () => {
      const patterns: FastPathPatternName[] = [
        "comparator",
        "range",
        "length",
        "inclusion",
        "required",
        "boolean",
      ];
      expect(patterns).toHaveLength(6);
    });
  });

  describe("RetrievalResult", () => {
    it("has required fields", () => {
      const result: RetrievalResult = {
        tier: 0,
        candidates: [
          { path: "User.age", score: 0.85, matchType: "exact", typeHint: null },
        ],
        queryTerms: ["age"],
      };
      expect(result.tier).toBe(0);
      expect(result.candidates).toHaveLength(1);
      expect(result.queryTerms).toContain("age");
    });

    it("has valid tier values", () => {
      const tiers: RetrievalTier[] = [0, 1, 2];
      expect(tiers).toEqual([0, 1, 2]);
    });

    it("has valid match types", () => {
      const types: MatchType[] = ["exact", "alias", "fuzzy", "semantic"];
      expect(types).toHaveLength(4);
    });
  });

  describe("AnchorCandidate", () => {
    it("has required fields", () => {
      const candidate: AnchorCandidate = {
        path: "User.age",
        score: 0.85,
        matchType: "exact",
        typeHint: { kind: "primitive", name: "number" },
      };
      expect(candidate.path).toBe("User.age");
      expect(candidate.score).toBeGreaterThanOrEqual(0);
      expect(candidate.score).toBeLessThanOrEqual(1);
      expect(candidate.matchType).toBe("exact");
    });
  });

  describe("ProposalResult", () => {
    it("has fragment when unambiguous", () => {
      const result: ProposalResult = {
        fragment: {
          fragmentId: "frag-001",
          sourceIntentId: "intent-001",
          description: "test",
          change: { kind: "constraint", path: "p", expr: { kind: "lit", value: true } },
          confidence: 0.9,
          evidence: [],
        },
        ambiguity: null,
        confidence: 0.9,
        reasoning: "Matched User.age field",
      };
      expect(result.fragment).toBeTruthy();
      expect(result.ambiguity).toBeNull();
    });

    it("has ambiguity when ambiguous", () => {
      const result: ProposalResult = {
        fragment: null,
        ambiguity: {
          kind: "anchor",
          question: "Which age field?",
          options: [],
          fallbackBehavior: "guess",
          expiresAt: Date.now() + 60000,
        },
        confidence: 0.5,
        reasoning: "Multiple age fields found",
      };
      expect(result.fragment).toBeNull();
      expect(result.ambiguity).toBeTruthy();
    });
  });

  describe("AmbiguityReport", () => {
    it("has required fields", () => {
      const report: AmbiguityReport = {
        kind: "anchor",
        question: "Which age field did you mean?",
        options: [
          {
            id: "opt-1",
            label: "User.age",
            fragment: {
              fragmentId: "frag-001",
              sourceIntentId: "intent-001",
              description: "test",
              change: { kind: "constraint", path: "User.age", expr: { kind: "lit", value: true } },
              confidence: 0.9,
              evidence: [],
            },
            confidence: 0.9,
          },
        ],
        fallbackBehavior: "guess",
        expiresAt: null,
      };
      expect(report.kind).toBe("anchor");
      expect(report.question).toBeTruthy();
      expect(report.options).toHaveLength(1);
    });

    it("has valid kind values", () => {
      const kinds: AmbiguityKind[] = ["anchor", "intent", "value", "conflict"];
      expect(kinds).toHaveLength(4);
    });
  });

  describe("ResolutionSelection", () => {
    it("supports select decision", () => {
      const selection: ResolutionSelection = {
        decision: "select",
        optionId: "opt-1",
        freeformInput: null,
      };
      expect(selection.decision).toBe("select");
      expect(selection.optionId).toBe("opt-1");
    });

    it("supports discard decision", () => {
      const selection: ResolutionSelection = {
        decision: "discard",
        optionId: null,
        freeformInput: null,
      };
      expect(selection.decision).toBe("discard");
    });

    it("supports freeform decision", () => {
      const selection: ResolutionSelection = {
        decision: "freeform",
        optionId: null,
        freeformInput: "User.age >= 18",
      };
      expect(selection.decision).toBe("freeform");
      expect(selection.freeformInput).toBeTruthy();
    });
  });

  describe("TranslationResult", () => {
    it("discriminates by kind: fragment", () => {
      const result: TranslationResultFragment = {
        kind: "fragment",
        fragment: {
          fragmentId: "frag-001",
          sourceIntentId: "intent-001",
          description: "test",
          change: { kind: "constraint", path: "p", expr: { kind: "lit", value: true } },
          confidence: 1.0,
          evidence: [],
        },
      };
      expect(result.kind).toBe("fragment");
    });

    it("discriminates by kind: ambiguity", () => {
      const result: TranslationResultAmbiguity = {
        kind: "ambiguity",
        report: {
          kind: "anchor",
          question: "Which field?",
          options: [],
          fallbackBehavior: "guess",
          expiresAt: null,
        },
      };
      expect(result.kind).toBe("ambiguity");
    });

    it("discriminates by kind: discarded", () => {
      const result: TranslationResultDiscarded = {
        kind: "discarded",
        reason: "User rejected",
      };
      expect(result.kind).toBe("discarded");
      expect(result.reason).toBeTruthy();
    });

    it("is a discriminated union", () => {
      const results: TranslationResult[] = [
        {
          kind: "fragment",
          fragment: {
            fragmentId: "f",
            sourceIntentId: "i",
            description: "d",
            change: { kind: "removeField", path: "p" },
            confidence: 1,
            evidence: [],
          },
        },
        {
          kind: "ambiguity",
          report: { kind: "anchor", question: "?", options: [], fallbackBehavior: "guess", expiresAt: null },
        },
        { kind: "discarded", reason: "r" },
      ];
      expect(results.map(r => r.kind)).toEqual(["fragment", "ambiguity", "discarded"]);
    });
  });

  describe("TranslatorState", () => {
    it("has all pipeline state fields", () => {
      const state: TranslatorState = {
        request: null,
        normalization: null,
        fastPath: null,
        retrieval: null,
        proposal: null,
        result: null,
        initializing: null,
        normalizing: null,
        fastPathing: null,
        retrieving: null,
        proposing: null,
        resolving: null,
        resetting: null,
      };
      expect(state.request).toBeNull();
      expect(state.normalization).toBeNull();
      expect(state.fastPath).toBeNull();
      expect(state.retrieval).toBeNull();
      expect(state.proposal).toBeNull();
      expect(state.result).toBeNull();
    });

    it("has all intent markers", () => {
      const state: TranslatorState = {
        request: null,
        normalization: null,
        fastPath: null,
        retrieval: null,
        proposal: null,
        result: null,
        initializing: "intent-001",
        normalizing: "intent-001",
        fastPathing: "intent-001",
        retrieving: "intent-001",
        proposing: "intent-001",
        resolving: null,
        resetting: null,
      };
      expect(state.initializing).toBe("intent-001");
      expect(state.normalizing).toBe("intent-001");
    });
  });

  describe("PipelineStage", () => {
    it("has all valid stages", () => {
      const stages: PipelineStage[] = [
        "idle",
        "normalizing",
        "fast-path",
        "retrieving",
        "proposing",
        "awaiting-resolution",
        "complete",
      ];
      expect(stages).toHaveLength(7);
    });
  });
});
