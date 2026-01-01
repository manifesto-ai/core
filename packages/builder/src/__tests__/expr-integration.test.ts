/**
 * Integration tests for new expression types (MEL SPEC v0.2)
 *
 * These tests verify that the new expressions work correctly
 * through the Builder -> Core evaluator pipeline.
 *
 * Package boundary compliance:
 * - Builder creates type-safe expressions
 * - Core evaluates them
 * - No Host/World dependencies (those are separate packages)
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { expr } from "../expr/expr-builder.js";
import { buildAccessor } from "../accessor/accessor-builder.js";
import {
  evaluateExpr,
  createContext,
  type Snapshot,
  type DomainSchema,
  isOk,
} from "@manifesto-ai/core";

// Helper to create a minimal test context
function createTestContext(data: unknown = {}): ReturnType<typeof createContext> {
  const snapshot: Snapshot = {
    data,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    input: undefined,
    meta: {
      version: 0,
      timestamp: Date.now(),
      schemaHash: "test-hash",
    },
  };

  const schema: DomainSchema = {
    id: "test",
    version: "1.0.0",
    hash: "test-hash",
    state: { fields: {} },
    computed: { fields: {} },
    actions: {},
  };

  return createContext(snapshot, schema, null, "test");
}

// Helper to evaluate an expression with given context
function evaluate(expression: ReturnType<typeof expr.lit>, data: Record<string, unknown> = {}) {
  const compiled = expression.compile();
  const ctx = createTestContext(data);
  const result = evaluateExpr(compiled, ctx);
  if (!isOk(result)) {
    throw new Error(`Evaluation failed: ${result.error.message}`);
  }
  return result.value;
}

// ============================================================================
// Scenario 1: E-commerce Price Calculator
// Tests: min, max, floor, round, neg, abs
// ============================================================================

describe("E-commerce Price Calculator", () => {
  const priceSchema = z.object({
    originalPrice: z.number(),
    discountPercent: z.number(),
    taxRate: z.number(),
    quantity: z.number(),
  });
  const priceState = buildAccessor(priceSchema);

  it("should calculate discount with floor rounding", () => {
    // 99 * 15% = 14.85, floor = 14
    const discountExpr = expr.floor(
      expr.mul(
        expr.get(priceState.originalPrice),
        expr.div(expr.get(priceState.discountPercent), 100)
      )
    );

    const result = evaluate(discountExpr, { originalPrice: 99, discountPercent: 15 });
    expect(result).toBe(14);
  });

  it("should clamp discount to valid range using min/max", () => {
    // Clamp discount between 0 and 100
    const clampedDiscountExpr = expr.min(expr.max(expr.get(priceState.discountPercent), 0), 100);

    // Over 100%
    expect(evaluate(clampedDiscountExpr, { discountPercent: 150 })).toBe(100);

    // Negative
    expect(evaluate(clampedDiscountExpr, { discountPercent: -20 })).toBe(0);

    // Normal range
    expect(evaluate(clampedDiscountExpr, { discountPercent: 25 })).toBe(25);
  });

  it("should ensure quantity is at least 1 using max", () => {
    const minQuantityExpr = expr.max(expr.get(priceState.quantity), 1);

    expect(evaluate(minQuantityExpr, { quantity: 5 })).toBe(5);
    expect(evaluate(minQuantityExpr, { quantity: 0 })).toBe(1);
    expect(evaluate(minQuantityExpr, { quantity: -3 })).toBe(1);
  });

  it("should apply negative adjustment using neg and abs", () => {
    // neg(abs(input)) always produces negative number for subtraction
    const adjustmentExpr = expr.neg(expr.abs(expr.lit(25)));
    expect(evaluate(adjustmentExpr)).toBe(-25);

    const adjustmentExpr2 = expr.neg(expr.abs(expr.lit(-10)));
    expect(evaluate(adjustmentExpr2)).toBe(-10);
  });

  it("should calculate discounted price (cannot be negative)", () => {
    // Discounted price = max(originalPrice - discount, 0)
    const discountedPriceExpr = expr.max(
      expr.sub(
        expr.get(priceState.originalPrice),
        expr.floor(
          expr.mul(
            expr.get(priceState.originalPrice),
            expr.div(expr.get(priceState.discountPercent), 100)
          )
        )
      ),
      0
    );

    // 99 - floor(99 * 0.15) = 99 - 14 = 85
    expect(evaluate(discountedPriceExpr, { originalPrice: 99, discountPercent: 15 })).toBe(85);

    // 100% discount = max(100 - 100, 0) = 0
    expect(evaluate(discountedPriceExpr, { originalPrice: 100, discountPercent: 100 })).toBe(0);

    // 200% discount = max(100 - 200, 0) = 0
    expect(evaluate(discountedPriceExpr, { originalPrice: 100, discountPercent: 200 })).toBe(0);
  });

  it("should calculate line total with round", () => {
    const lineTotalExpr = expr.round(
      expr.mul(expr.get(priceState.quantity), expr.get(priceState.originalPrice))
    );

    expect(evaluate(lineTotalExpr, { quantity: 3, originalPrice: 33.33 })).toBe(100);
    expect(evaluate(lineTotalExpr, { quantity: 2, originalPrice: 19.99 })).toBe(40);
  });
});

// ============================================================================
// Scenario 2: User Profile Manager
// Tests: trim, toLowerCase, toUpperCase, strLen
// ============================================================================

describe("User Profile Manager", () => {
  const profileSchema = z.object({
    username: z.string(),
    displayName: z.string(),
    bio: z.string(),
  });
  const profileState = buildAccessor(profileSchema);

  it("should normalize username with trim and toLowerCase", () => {
    const normalizedExpr = expr.toLowerCase(expr.trim(expr.get(profileState.username)));

    expect(evaluate(normalizedExpr, { username: "  JohnDoe123  " })).toBe("johndoe123");
    expect(evaluate(normalizedExpr, { username: "ADMIN" })).toBe("admin");
    expect(evaluate(normalizedExpr, { username: "  MixedCase  " })).toBe("mixedcase");
  });

  it("should create banner name with toUpperCase", () => {
    const bannerExpr = expr.toUpperCase(expr.trim(expr.get(profileState.displayName)));

    expect(evaluate(bannerExpr, { displayName: "  Alice Smith  " })).toBe("ALICE SMITH");
    expect(evaluate(bannerExpr, { displayName: "john" })).toBe("JOHN");
  });

  it("should calculate bio length with strLen", () => {
    const bioLenExpr = expr.strLen(expr.get(profileState.bio));

    expect(evaluate(bioLenExpr, { bio: "Hello, World!" })).toBe(13);
    expect(evaluate(bioLenExpr, { bio: "" })).toBe(0);
    expect(evaluate(bioLenExpr, { bio: "こんにちは" })).toBe(5); // Unicode support
  });

  it("should detect bio too long", () => {
    const bioTooLongExpr = expr.gt(expr.strLen(expr.get(profileState.bio)), 140);

    expect(evaluate(bioTooLongExpr, { bio: "a".repeat(140) })).toBe(false);
    expect(evaluate(bioTooLongExpr, { bio: "a".repeat(141) })).toBe(true);
    expect(evaluate(bioTooLongExpr, { bio: "short bio" })).toBe(false);
  });

  it("should calculate trimmed bio length", () => {
    const trimmedBioLenExpr = expr.strLen(expr.trim(expr.get(profileState.bio)));

    expect(evaluate(trimmedBioLenExpr, { bio: "  hello  " })).toBe(5);
    expect(evaluate(trimmedBioLenExpr, { bio: "   " })).toBe(0);
  });

  it("should handle whitespace-only input", () => {
    const normalizedExpr = expr.toLowerCase(expr.trim(expr.get(profileState.username)));

    expect(evaluate(normalizedExpr, { username: "   " })).toBe("");
    expect(evaluate(normalizedExpr, { username: "\t\n" })).toBe("");
  });
});

// ============================================================================
// Scenario 3: Scientific Calculator
// Tests: sqrt, pow, abs, ceil, floor, round
// ============================================================================

describe("Scientific Calculator", () => {
  const calcSchema = z.object({
    value: z.number(),
    memory: z.number(),
  });
  const calcState = buildAccessor(calcSchema);

  it("should compute sqrt correctly", () => {
    const sqrtExpr = expr.sqrt(expr.get(calcState.value));

    expect(evaluate(sqrtExpr, { value: 16 })).toBe(4);
    expect(evaluate(sqrtExpr, { value: 9 })).toBe(3);
    expect(evaluate(sqrtExpr, { value: 2 })).toBeCloseTo(1.414, 3);
    expect(evaluate(sqrtExpr, { value: 0 })).toBe(0);
  });

  it("should return null for sqrt of negative (totality)", () => {
    const sqrtExpr = expr.sqrt(expr.get(calcState.value));

    expect(evaluate(sqrtExpr, { value: -9 })).toBe(null);
    expect(evaluate(sqrtExpr, { value: -1 })).toBe(null);
  });

  it("should compute pow correctly", () => {
    const squaredExpr = expr.pow(expr.get(calcState.value), 2);
    const cubedExpr = expr.pow(expr.get(calcState.value), 3);

    expect(evaluate(squaredExpr, { value: 3 })).toBe(9);
    expect(evaluate(cubedExpr, { value: 3 })).toBe(27);

    expect(evaluate(squaredExpr, { value: -2 })).toBe(4);
    expect(evaluate(cubedExpr, { value: -2 })).toBe(-8);

    // Edge cases
    expect(evaluate(expr.pow(expr.lit(2), 0))).toBe(1);
    expect(evaluate(expr.pow(expr.lit(2), -1))).toBe(0.5);
  });

  it("should compute all rounding modes", () => {
    const floorExpr = expr.floor(expr.get(calcState.value));
    const ceilExpr = expr.ceil(expr.get(calcState.value));
    const roundExpr = expr.round(expr.get(calcState.value));

    // Positive decimals
    expect(evaluate(floorExpr, { value: 3.7 })).toBe(3);
    expect(evaluate(ceilExpr, { value: 3.2 })).toBe(4);
    expect(evaluate(roundExpr, { value: 3.5 })).toBe(4);
    expect(evaluate(roundExpr, { value: 3.4 })).toBe(3);

    // Negative decimals
    expect(evaluate(floorExpr, { value: -3.2 })).toBe(-4);
    expect(evaluate(ceilExpr, { value: -3.7 })).toBe(-3);
    expect(evaluate(roundExpr, { value: -3.5 })).toBe(-3);
  });

  it("should compute absolute value", () => {
    const absExpr = expr.abs(expr.get(calcState.value));

    expect(evaluate(absExpr, { value: 5 })).toBe(5);
    expect(evaluate(absExpr, { value: -5 })).toBe(5);
    expect(evaluate(absExpr, { value: 0 })).toBe(0);
  });

  it("should negate values", () => {
    const negExpr = expr.neg(expr.get(calcState.value));

    expect(evaluate(negExpr, { value: 5 })).toBe(-5);
    expect(evaluate(negExpr, { value: -3 })).toBe(3);
    // -0 === 0
    expect(evaluate(negExpr, { value: 0 }) === 0).toBe(true);
  });

  it("should handle sqrt with coalesce for negatives", () => {
    // sqrt(x) ?? 0 - return 0 for negative numbers
    const safeSqrtExpr = expr.coalesce(expr.sqrt(expr.get(calcState.value)), 0);

    expect(evaluate(safeSqrtExpr, { value: 25 })).toBe(5);
    expect(evaluate(safeSqrtExpr, { value: -16 })).toBe(0);
  });
});

// ============================================================================
// Scenario 4: Complex Expression Compositions
// Tests: Combining multiple new expressions together
// ============================================================================

describe("Complex Expression Compositions", () => {
  it("should compute distance formula: sqrt(pow(x2-x1, 2) + pow(y2-y1, 2))", () => {
    const coordSchema = z.object({
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
    });
    const coordState = buildAccessor(coordSchema);

    const distanceExpr = expr.sqrt(
      expr.add(
        expr.pow(expr.sub(expr.get(coordState.x2), expr.get(coordState.x1)), 2),
        expr.pow(expr.sub(expr.get(coordState.y2), expr.get(coordState.y1)), 2)
      )
    );

    // Distance from (0,0) to (3,4) = 5
    expect(evaluate(distanceExpr, { x1: 0, y1: 0, x2: 3, y2: 4 })).toBe(5);

    // Distance from (1,1) to (4,5) = 5
    expect(evaluate(distanceExpr, { x1: 1, y1: 1, x2: 4, y2: 5 })).toBe(5);
  });

  it("should normalize and validate email format", () => {
    const emailSchema = z.object({
      email: z.string(),
    });
    const emailState = buildAccessor(emailSchema);

    // Normalize: trim and lowercase
    const normalizedExpr = expr.toLowerCase(expr.trim(expr.get(emailState.email)));

    // Minimum length check (at least 5 chars for x@y.z)
    const validLengthExpr = expr.gte(
      expr.strLen(expr.toLowerCase(expr.trim(expr.get(emailState.email)))),
      5
    );

    expect(evaluate(normalizedExpr, { email: "  USER@Example.COM  " })).toBe("user@example.com");
    expect(evaluate(validLengthExpr, { email: "a@b.c" })).toBe(true);
    expect(evaluate(validLengthExpr, { email: "ab" })).toBe(false);
  });

  it("should compute BMI with proper rounding", () => {
    const healthSchema = z.object({
      weightKg: z.number(),
      heightM: z.number(),
    });
    const healthState = buildAccessor(healthSchema);

    // BMI = weight / height^2, rounded to 1 decimal (simulate with *10, round, /10)
    const bmiExpr = expr.div(
      expr.round(
        expr.mul(
          expr.div(
            expr.get(healthState.weightKg),
            expr.pow(expr.get(healthState.heightM), 2)
          ),
          10
        )
      ),
      10
    );

    // 70kg, 1.75m => BMI = 70 / 3.0625 = 22.857... => rounded to 22.9
    expect(evaluate(bmiExpr, { weightKg: 70, heightM: 1.75 })).toBe(22.9);
  });

  it("should compute price with tiered discounts", () => {
    const orderSchema = z.object({
      subtotal: z.number(),
    });
    const orderState = buildAccessor(orderSchema);

    // Tiered discount:
    // < $50: no discount
    // $50-$100: 10% off
    // > $100: 20% off
    const discountRateExpr = expr.cond(
      expr.lt(expr.get(orderState.subtotal), 50),
      0,
      expr.cond(
        expr.lte(expr.get(orderState.subtotal), 100),
        10,
        20
      )
    );

    const finalPriceExpr = expr.round(
      expr.sub(
        expr.get(orderState.subtotal),
        expr.mul(
          expr.get(orderState.subtotal),
          expr.div(
            expr.cond(
              expr.lt(expr.get(orderState.subtotal), 50),
              0,
              expr.cond(
                expr.lte(expr.get(orderState.subtotal), 100),
                10,
                20
              )
            ),
            100
          )
        )
      )
    );

    expect(evaluate(discountRateExpr, { subtotal: 30 })).toBe(0);
    expect(evaluate(discountRateExpr, { subtotal: 75 })).toBe(10);
    expect(evaluate(discountRateExpr, { subtotal: 150 })).toBe(20);

    expect(evaluate(finalPriceExpr, { subtotal: 30 })).toBe(30);
    expect(evaluate(finalPriceExpr, { subtotal: 75 })).toBe(68); // 75 - 7.5 = 67.5 => 68
    expect(evaluate(finalPriceExpr, { subtotal: 150 })).toBe(120); // 150 - 30 = 120
  });

  it("should format display name with validation", () => {
    const userSchema = z.object({
      firstName: z.string(),
      lastName: z.string(),
    });
    const userState = buildAccessor(userSchema);

    // Trim names
    const trimmedFirstExpr = expr.trim(expr.get(userState.firstName));
    const trimmedLastExpr = expr.trim(expr.get(userState.lastName));

    // Total name length
    const totalLengthExpr = expr.add(
      expr.strLen(expr.trim(expr.get(userState.firstName))),
      expr.strLen(expr.trim(expr.get(userState.lastName)))
    );

    // Name too long (> 50 chars combined)
    const nameTooLongExpr = expr.gt(
      expr.add(
        expr.strLen(expr.trim(expr.get(userState.firstName))),
        expr.strLen(expr.trim(expr.get(userState.lastName)))
      ),
      50
    );

    expect(evaluate(trimmedFirstExpr, { firstName: "  John  " })).toBe("John");
    expect(evaluate(trimmedLastExpr, { lastName: "  Doe  " })).toBe("Doe");
    expect(evaluate(totalLengthExpr, { firstName: "John", lastName: "Doe" })).toBe(7);
    expect(evaluate(nameTooLongExpr, { firstName: "a".repeat(30), lastName: "b".repeat(25) })).toBe(true);
  });
});

// ============================================================================
// Scenario 5: Edge Cases and Error Handling
// Tests: Totality principle - expressions should never throw
// ============================================================================

describe("Edge Cases and Totality", () => {
  it("should handle sqrt of zero", () => {
    expect(evaluate(expr.sqrt(expr.lit(0)))).toBe(0);
  });

  it("should handle pow with zero exponent", () => {
    expect(evaluate(expr.pow(expr.lit(5), 0))).toBe(1);
    expect(evaluate(expr.pow(expr.lit(0), 0))).toBe(1); // Mathematical convention
  });

  it("should handle pow with negative exponent", () => {
    expect(evaluate(expr.pow(expr.lit(2), -1))).toBe(0.5);
    expect(evaluate(expr.pow(expr.lit(4), -2))).toBe(0.0625);
  });

  it("should handle empty string operations", () => {
    expect(evaluate(expr.trim(expr.lit("")))).toBe("");
    expect(evaluate(expr.toLowerCase(expr.lit("")))).toBe("");
    expect(evaluate(expr.toUpperCase(expr.lit("")))).toBe("");
    expect(evaluate(expr.strLen(expr.lit("")))).toBe(0);
  });

  it("should handle min/max with single value", () => {
    expect(evaluate(expr.min(expr.lit(42)))).toBe(42);
    expect(evaluate(expr.max(expr.lit(42)))).toBe(42);
  });

  it("should handle min/max with many values", () => {
    expect(evaluate(expr.min(expr.lit(5), expr.lit(3), expr.lit(8), expr.lit(1), expr.lit(9)))).toBe(1);
    expect(evaluate(expr.max(expr.lit(5), expr.lit(3), expr.lit(8), expr.lit(1), expr.lit(9)))).toBe(9);
  });

  it("should handle nested operations", () => {
    // abs(neg(floor(ceil(round(3.5)))))
    const nestedExpr = expr.abs(expr.neg(expr.floor(expr.ceil(expr.round(expr.lit(3.5))))));
    // 3.5 -> round -> 4 -> ceil -> 4 -> floor -> 4 -> neg -> -4 -> abs -> 4
    expect(evaluate(nestedExpr)).toBe(4);
  });

  it("should handle special float values", () => {
    expect(evaluate(expr.floor(expr.lit(0.1 + 0.2)))).toBe(0); // 0.30000000000000004 -> 0
    expect(evaluate(expr.round(expr.lit(0.1 + 0.2)))).toBe(0); // rounds to 0
    expect(evaluate(expr.ceil(expr.lit(0.1 + 0.2)))).toBe(1); // 0.3... -> 1
  });
});
