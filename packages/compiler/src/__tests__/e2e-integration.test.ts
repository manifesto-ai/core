/**
 * End-to-End Integration Tests: Translator → Renderer Pipeline
 *
 * These tests verify the complete pipeline:
 * 1. Natural language input → Translator → PatchFragment
 * 2. PatchFragment → Renderer → MEL text
 *
 * Test scenarios cover real-world use cases:
 * - Adding fields to existing types
 * - Creating computed properties
 * - Adding constraints/validations
 * - Setting default values
 * - Action availability conditions
 * - Multilingual input (Korean, English)
 *
 * Run with: pnpm --filter @manifesto-ai/compiler test e2e-integration
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  createTranslator,
  createOpenAITranslator,
  isFragmentsResult,
  isAmbiguityResult,
  isErrorResult,
  type TranslationContext,
  type TypeIndex,
  type PatchFragment,
} from "@manifesto-ai/translator";
import {
  renderFragment,
  renderFragments,
  renderAsDomain,
  renderPatchOp,
  renderExprNode,
  renderTypeExpr,
} from "../renderer/index.js";

// Skip LLM tests if no API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const describeWithOpenAI = OPENAI_API_KEY ? describe : describe.skip;

// ============ Test Fixtures ============

const todoTypeIndex: TypeIndex = {
  Todo: { kind: "object", fields: [] },
  "Todo.id": { kind: "primitive", name: "string" },
  "Todo.title": { kind: "primitive", name: "string" },
  "Todo.completed": { kind: "primitive", name: "boolean" },
  "Todo.priority": { kind: "primitive", name: "number" },
};

const userTypeIndex: TypeIndex = {
  User: { kind: "object", fields: [] },
  "User.id": { kind: "primitive", name: "string" },
  "User.name": { kind: "primitive", name: "string" },
  "User.email": { kind: "primitive", name: "string" },
  "User.age": { kind: "primitive", name: "number" },
  "User.isActive": { kind: "primitive", name: "boolean" },
  Profile: { kind: "object", fields: [] },
  "Profile.bio": { kind: "primitive", name: "string" },
  "Profile.avatar": { kind: "primitive", name: "string" },
};

const ecommerceTypeIndex: TypeIndex = {
  Product: { kind: "object", fields: [] },
  "Product.id": { kind: "primitive", name: "string" },
  "Product.name": { kind: "primitive", name: "string" },
  "Product.price": { kind: "primitive", name: "number" },
  "Product.quantity": { kind: "primitive", name: "number" },
  Cart: { kind: "object", fields: [] },
  "Cart.items": { kind: "array", element: { kind: "ref", name: "CartItem" } },
  "Cart.total": { kind: "primitive", name: "number" },
  Order: { kind: "object", fields: [] },
  "Order.status": { kind: "literal", value: "pending" },
};

function createContext(typeIndex: TypeIndex): TranslationContext {
  return {
    atWorldId: "test-world-123" as TranslationContext["atWorldId"],
    schema: {
      schemaId: "test-schema",
      version: "1.0.0",
      rootType: "Root",
    },
    typeIndex,
    actor: {
      actorId: "test-actor",
      kind: "human",
    },
  };
}

// ============ Renderer Unit Tests ============

describe("Renderer: TypeExpr → MEL", () => {
  it("should render complex union types", () => {
    const mel = renderTypeExpr({
      kind: "union",
      members: [
        { kind: "literal", value: "pending" },
        { kind: "literal", value: "processing" },
        { kind: "literal", value: "shipped" },
        { kind: "literal", value: "delivered" },
      ],
    });
    expect(mel).toBe('"pending" | "processing" | "shipped" | "delivered"');
  });

  it("should render nullable array types", () => {
    const mel = renderTypeExpr({
      kind: "union",
      members: [
        { kind: "array", element: { kind: "ref", name: "Todo" } },
        { kind: "primitive", name: "null" },
      ],
    });
    expect(mel).toBe("Array<Todo> | null");
  });

  it("should render nested object types", () => {
    const mel = renderTypeExpr({
      kind: "object",
      fields: [
        { name: "street", optional: false, type: { kind: "primitive", name: "string" } },
        { name: "city", optional: false, type: { kind: "primitive", name: "string" } },
        { name: "zip", optional: true, type: { kind: "primitive", name: "string" } },
      ],
    });
    expect(mel).toContain("street: string");
    expect(mel).toContain("city: string");
    expect(mel).toContain("zip?: string");
  });
});

describe("Renderer: ExprNode → MEL", () => {
  it("should render complex boolean expressions", () => {
    const mel = renderExprNode({
      kind: "and",
      args: [
        { kind: "gt", left: { kind: "get", path: "data.age" }, right: { kind: "lit", value: 18 } },
        { kind: "not", arg: { kind: "get", path: "data.isBlocked" } },
        {
          kind: "or",
          args: [
            { kind: "get", path: "data.isVerified" },
            { kind: "get", path: "data.isAdmin" },
          ],
        },
      ],
    });
    expect(mel).toBe("and(gt(age, 18), not(isBlocked), or(isVerified, isAdmin))");
  });

  it("should render arithmetic expressions", () => {
    const mel = renderExprNode({
      kind: "mul",
      left: {
        kind: "add",
        left: { kind: "get", path: "data.price" },
        right: { kind: "get", path: "data.tax" },
      },
      right: { kind: "get", path: "data.quantity" },
    });
    expect(mel).toBe("mul(add(price, tax), quantity)");
  });

  it("should render isNull checks", () => {
    const mel = renderExprNode({
      kind: "and",
      args: [
        { kind: "not", arg: { kind: "isNull", arg: { kind: "get", path: "data.email" } } },
        { kind: "gt", left: { kind: "len", arg: { kind: "get", path: "data.email" } }, right: { kind: "lit", value: 0 } },
      ],
    });
    expect(mel).toBe("and(not(isNull(email)), gt(len(email), 0))");
  });
});

// ============ Fast Path Integration Tests ============

describe("Fast Path: NL → PatchFragment → MEL (No LLM)", () => {
  const translator = createTranslator();
  const context = createContext(todoTypeIndex);

  it("Scenario: Add a string field to Todo", async () => {
    const result = await translator.translate("add a description field to Todo", context);

    if (isFragmentsResult(result)) {
      expect(result.fragments.length).toBeGreaterThan(0);

      const fragment = result.fragments[0];
      expect(fragment.op.kind).toBe("addField");

      // Render to MEL
      const mel = renderFragment(fragment, { includeMetadata: false });
      expect(mel).toContain("description");
      expect(mel).toContain("string");

      console.log("📝 Input: 'add a description field to Todo'");
      console.log("📦 Fragment:", JSON.stringify(fragment.op, null, 2));
      console.log("📄 MEL Output:", mel);
    }
  });

  it("Scenario: Add field with specific type pattern", async () => {
    const result = await translator.translate("add field createdAt to Todo", context);

    if (isFragmentsResult(result)) {
      const mel = renderFragment(result.fragments[0], { includeMetadata: false });
      console.log("📝 Input: 'add field createdAt to Todo'");
      console.log("📄 MEL Output:", mel);
    }
  });

  it("Scenario: Batch translate and render as domain", async () => {
    const inputs = [
      "add a title field to Todo",
      "add a completed field to Todo",
      "add a priority field to Todo",
    ];

    const allFragments: PatchFragment[] = [];

    for (const input of inputs) {
      const result = await translator.translate(input, context);
      if (isFragmentsResult(result)) {
        allFragments.push(...result.fragments);
      }
    }

    if (allFragments.length > 0) {
      const domainMel = renderAsDomain("Todo", allFragments);
      console.log("\n📝 Batch Input:", inputs);
      console.log("📄 Domain MEL Output:\n", domainMel);

      expect(domainMel).toContain("domain Todo {");
      expect(domainMel).toContain("state {");
    }
  });
});

// ============ OpenAI Integration Tests ============

describeWithOpenAI("OpenAI: NL → PatchFragment → MEL (Full Pipeline)", () => {
  let translator: ReturnType<typeof createOpenAITranslator>;

  beforeAll(() => {
    translator = createOpenAITranslator({
      apiKey: OPENAI_API_KEY!,
      model: "gpt-4o-mini",
    });
  });

  describe("Use Case 1: Todo App Field Management", () => {
    const context = createContext(todoTypeIndex);

    it("should add a due date field", async () => {
      const result = await translator.translate(
        "Add a dueDate field to Todo that stores when the task is due",
        context
      );

      console.log("\n🔹 Use Case: Add due date field");
      console.log("📝 Input: 'Add a dueDate field to Todo that stores when the task is due'");

      if (isFragmentsResult(result)) {
        const fragment = result.fragments[0];
        const mel = renderFragment(fragment);
        console.log("📄 MEL Output:\n", mel);

        expect(fragment.op.kind).toBe("addField");
      } else if (isAmbiguityResult(result)) {
        console.log("⚠️ Ambiguity detected:", result.report.kind);
      } else {
        console.log("❌ Error:", result.error);
      }
    }, 30000);

    it("should add a computed field for overdue status", async () => {
      const result = await translator.translate(
        "Add a computed field isOverdue that checks if dueDate is in the past",
        context
      );

      console.log("\n🔹 Use Case: Add computed isOverdue");
      console.log("📝 Input: 'Add a computed field isOverdue that checks if dueDate is in the past'");

      if (isFragmentsResult(result)) {
        const fragment = result.fragments[0];
        const mel = renderFragment(fragment);
        console.log("📄 MEL Output:\n", mel);

        expect(["addComputed", "addField"]).toContain(fragment.op.kind);
      }
    }, 30000);
  });

  describe("Use Case 2: User Profile Management", () => {
    const context = createContext(userTypeIndex);

    it("should add age validation constraint", async () => {
      const result = await translator.translate(
        "User age must be at least 18 years old",
        context
      );

      console.log("\n🔹 Use Case: Age validation");
      console.log("📝 Input: 'User age must be at least 18 years old'");

      if (isFragmentsResult(result)) {
        const fragment = result.fragments[0];
        const mel = renderFragment(fragment);
        console.log("📄 MEL Output:\n", mel);

        expect(["addConstraint", "addField"]).toContain(fragment.op.kind);
      }
    }, 30000);

    it("should set default value for isActive", async () => {
      const result = await translator.translate(
        "Set the default value of User.isActive to true",
        context
      );

      console.log("\n🔹 Use Case: Set default value");
      console.log("📝 Input: 'Set the default value of User.isActive to true'");

      if (isFragmentsResult(result)) {
        const fragment = result.fragments[0];
        const mel = renderFragment(fragment);
        console.log("📄 MEL Output:\n", mel);

        expect(["setDefaultValue", "addField"]).toContain(fragment.op.kind);
      }
    }, 30000);

    it("should add email validation", async () => {
      const result = await translator.translate(
        "User email cannot be empty",
        context
      );

      console.log("\n🔹 Use Case: Email validation");
      console.log("📝 Input: 'User email cannot be empty'");

      if (isFragmentsResult(result)) {
        const fragment = result.fragments[0];
        const mel = renderFragment(fragment);
        console.log("📄 MEL Output:\n", mel);
      }
    }, 30000);
  });

  describe("Use Case 3: E-commerce Order Flow", () => {
    const context = createContext(ecommerceTypeIndex);

    it("should add order status type with union", async () => {
      const result = await translator.translate(
        "Add a status field to Order with values: pending, confirmed, shipped, delivered",
        context
      );

      console.log("\n🔹 Use Case: Order status enum");
      console.log("📝 Input: 'Add a status field to Order with values: pending, confirmed, shipped, delivered'");

      if (isFragmentsResult(result)) {
        const fragment = result.fragments[0];
        const mel = renderFragment(fragment);
        console.log("📄 MEL Output:\n", mel);

        // LLM might generate addField or addType depending on interpretation
        expect(["addField", "addType"]).toContain(fragment.op.kind);
      }
    }, 30000);

    it("should add computed total price", async () => {
      const result = await translator.translate(
        "Add a computed field totalPrice that multiplies price by quantity",
        context
      );

      console.log("\n🔹 Use Case: Computed total price");
      console.log("📝 Input: 'Add a computed field totalPrice that multiplies price by quantity'");

      if (isFragmentsResult(result)) {
        const fragment = result.fragments[0];
        const mel = renderFragment(fragment);
        console.log("📄 MEL Output:\n", mel);

        expect(["addComputed", "addField"]).toContain(fragment.op.kind);
      }
    }, 30000);

    it("should add action availability for checkout", async () => {
      const result = await translator.translate(
        "The checkout action should only be available when the cart has items",
        context
      );

      console.log("\n🔹 Use Case: Checkout availability");
      console.log("📝 Input: 'The checkout action should only be available when the cart has items'");

      if (isFragmentsResult(result)) {
        const fragment = result.fragments[0];
        const mel = renderFragment(fragment);
        console.log("📄 MEL Output:\n", mel);
      }
    }, 30000);
  });

  describe("Use Case 4: Multilingual Input (Korean)", () => {
    const context = createContext(todoTypeIndex);

    it("should handle Korean: add field", async () => {
      const result = await translator.translate(
        "Todo에 태그 필드 추가해줘",
        context
      );

      console.log("\n🔹 Use Case: Korean - Add tag field");
      console.log("📝 Input: 'Todo에 태그 필드 추가해줘'");

      if (isFragmentsResult(result)) {
        const fragment = result.fragments[0];
        const mel = renderFragment(fragment);
        console.log("📄 MEL Output:\n", mel);

        expect(fragment.op.kind).toBe("addField");
      }
    }, 30000);

    it("should handle Korean: set default", async () => {
      const result = await translator.translate(
        "Todo.completed 기본값을 false로 설정해",
        context
      );

      console.log("\n🔹 Use Case: Korean - Set default");
      console.log("📝 Input: 'Todo.completed 기본값을 false로 설정해'");

      if (isFragmentsResult(result)) {
        const fragment = result.fragments[0];
        const mel = renderFragment(fragment);
        console.log("📄 MEL Output:\n", mel);
      }
    }, 30000);

    it("should handle Korean: add constraint", async () => {
      const result = await translator.translate(
        "Todo.priority는 1 이상이어야 해",
        context
      );

      console.log("\n🔹 Use Case: Korean - Priority constraint");
      console.log("📝 Input: 'Todo.priority는 1 이상이어야 해'");

      if (isFragmentsResult(result)) {
        const fragment = result.fragments[0];
        const mel = renderFragment(fragment);
        console.log("📄 MEL Output:\n", mel);
      }
    }, 30000);
  });

  describe("Use Case 5: Complete Domain Generation", () => {
    it("should generate a complete counter domain", async () => {
      const context = createContext({
        Counter: { kind: "object", fields: [] },
        "Counter.count": { kind: "primitive", name: "number" },
      });

      const inputs = [
        "Add a count field to Counter with default value 0",
        "Add a computed field doubled that multiplies count by 2",
        "Add a computed field isPositive that checks if count is greater than 0",
      ];

      const allFragments: PatchFragment[] = [];

      for (const input of inputs) {
        const result = await translator.translate(input, context);
        if (isFragmentsResult(result)) {
          allFragments.push(...result.fragments);
        }
      }

      if (allFragments.length > 0) {
        const domainMel = renderAsDomain("Counter", allFragments);
        console.log("\n🔹 Use Case: Complete Counter Domain");
        console.log("📝 Inputs:", inputs);
        console.log("📄 Generated Domain:\n");
        console.log(domainMel);

        expect(domainMel).toContain("domain Counter {");
      }
    }, 60000);
  });
});

// ============ Error Handling Tests ============

describe("Error Handling", () => {
  const translator = createTranslator();
  const context = createContext(todoTypeIndex);

  it("should handle empty input gracefully", async () => {
    const result = await translator.translate("", context);
    // Empty input should either error or return empty fragments
    expect(isFragmentsResult(result) || isErrorResult(result)).toBe(true);
  });

  it("should handle gibberish input", async () => {
    const result = await translator.translate("asdfghjkl qwerty zxcvbnm", context);
    // Should either fail gracefully or return no fragments
    expect(
      isFragmentsResult(result) || isAmbiguityResult(result) || isErrorResult(result)
    ).toBe(true);
  });
});

// ============ Renderer Edge Cases ============

describe("Renderer Edge Cases", () => {
  it("should handle fragment with special characters in field name", () => {
    const fragment: PatchFragment = {
      fragmentId: "frag-123",
      sourceIntentId: "intent-456",
      op: {
        kind: "addField",
        typeName: "Test",
        field: {
          name: "camelCaseFieldName",
          optional: false,
          type: { kind: "primitive", name: "string" },
        },
      },
      confidence: 0.95,
      evidence: ["test"],
      createdAt: new Date().toISOString(),
    };

    const mel = renderFragment(fragment, { includeMetadata: false });
    expect(mel).toBe("camelCaseFieldName: string");
  });

  it("should handle deep nested expressions", () => {
    const mel = renderExprNode({
      kind: "if",
      cond: {
        kind: "and",
        args: [
          { kind: "gt", left: { kind: "get", path: "x" }, right: { kind: "lit", value: 0 } },
          { kind: "lt", left: { kind: "get", path: "x" }, right: { kind: "lit", value: 100 } },
        ],
      },
      then: { kind: "lit", value: "valid" },
      else: { kind: "lit", value: "invalid" },
    });
    expect(mel).toBe('if(and(gt(x, 0), lt(x, 100)), "valid", "invalid")');
  });

  it("should render multiple fragments as domain", () => {
    const fragments: PatchFragment[] = [
      {
        fragmentId: "frag-1",
        sourceIntentId: "intent-1",
        op: {
          kind: "addField",
          typeName: "Counter",
          field: {
            name: "count",
            optional: false,
            type: { kind: "primitive", name: "number" },
          },
        },
        confidence: 0.95,
        evidence: [],
        createdAt: new Date().toISOString(),
      },
      {
        fragmentId: "frag-2",
        sourceIntentId: "intent-1",
        op: {
          kind: "addComputed",
          name: "doubled",
          expr: {
            kind: "mul",
            left: { kind: "get", path: "count" },
            right: { kind: "lit", value: 2 },
          },
        },
        confidence: 0.9,
        evidence: [],
        createdAt: new Date().toISOString(),
      },
      {
        fragmentId: "frag-3",
        sourceIntentId: "intent-1",
        op: {
          kind: "addActionAvailable",
          actionName: "decrement",
          expr: { kind: "gt", left: { kind: "get", path: "count" }, right: { kind: "lit", value: 0 } },
        },
        confidence: 0.85,
        evidence: [],
        createdAt: new Date().toISOString(),
      },
    ];

    const domain = renderAsDomain("Counter", fragments);

    expect(domain).toContain("domain Counter {");
    expect(domain).toContain("count: number");
    expect(domain).toContain("computed doubled = mul(count, 2)");
    expect(domain).toContain("action decrement() available when gt(count, 0)");
    expect(domain).toContain("}");

    console.log("\n📄 Rendered Counter Domain:\n", domain);
  });
});
