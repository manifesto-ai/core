import { describe, expect, it } from "vitest";
import { compile } from "../../src/index.js";

function compileSource(source: string) {
  return compile(source);
}

describe("Expression type checking", () => {
  it("rejects builtin argument type mismatches", () => {
    const result = compileSource(`
      domain PaymentLedger {
        state { balance: string = "10" }
        computed nextBalance = add(balance, 1)
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects non-boolean guards", () => {
    const result = compileSource(`
      domain PaymentLedger {
        state { amount: number = 1 }

        action settle() {
          onceIntent {
            when amount {
              patch amount = 2
            }
          }
        }
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects cross-type equality", () => {
    const result = compileSource(`
      domain ApprovalWorkflow {
        state { requestId: string = "abc" }
        computed isMatch = eq(requestId, 1)
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects non-numeric comparisons", () => {
    const result = compileSource(`
      domain ApprovalWorkflow {
        state { requestId: string = "abc" }
        computed isAfter = gt(requestId, 1)
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects collection predicate type mismatches", () => {
    const result = compileSource(`
      domain TodoWorkspace {
        state { todos: Array<string> = [] }
        computed filtered = filter(todos, "yes")
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects collection mapper type mismatches", () => {
    const result = compileSource(`
      domain InventoryCatalog {
        type Item = { name: string }

        state { items: Array<Item> = [] }
        computed mapped = map(items, add($item.name, 1))
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects incompatible coalesce branches", () => {
    const result = compileSource(`
      domain Test {
        state { count: number = 0 }
        computed value = coalesce(count, "oops")
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects action parameter misuse in patch assignment", () => {
    const result = compileSource(`
      domain Test {
        state { count: number = 0 }

        action rename(title: string) {
          when true {
            patch count = title
          }
        }
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("accepts numeric arithmetic on numeric fields and params", () => {
    const result = compileSource(`
      domain Counter {
        state { count: number = 0 }

        action add(amount: number) {
          when gt(amount, 0) {
            patch count = add(count, amount)
          }
        }
      }
    `);

    expect(result.success).toBe(true);
  });

  it("accepts boolean-valued guards", () => {
    const result = compileSource(`
      domain Counter {
        state { count: number = 0 }

        action increment() {
          when gt(count, -1) {
            patch count = add(count, 1)
          }
        }
      }
    `);

    expect(result.success).toBe(true);
  });

  it("accepts correctly typed filter/map callbacks", () => {
    const result = compileSource(`
      domain TodoWorkspace {
        type Todo = { id: string, title: string, done: boolean }

        state { todos: Array<Todo> = [] }
        computed openTodos = filter(todos, eq($item.done, false))
        computed titles = map(todos, $item.title)
      }
    `);

    expect(result.success).toBe(true);
  });

  it("accepts coalesce with compatible nullable branches", () => {
    const result = compileSource(`
      domain TodoWorkspace {
        type Todo = { id: string, title: string }

        state {
          todos: Array<Todo> = []
          selectedId: string = ""
        }

        computed selected = findById(todos, selectedId)
        computed fallback = { id: "fallback", title: "Inbox" }
        computed chosen = coalesce(selected, fallback)
      }
    `);

    expect(result.success).toBe(true);
  });

  it("accepts coalesce as a numeric fallback for bounded numeric calls", () => {
    const result = compileSource(`
      domain Demo {
        state { count: number = 1 }
        computed maybe = idiv(count, 2)
        computed safe = clamp(coalesce(maybe, 0), 0, 10)
      }
    `);

    expect(result.success).toBe(true);
  });

  it("accepts coalesce as a non-null selector fallback for match", () => {
    const result = compileSource(`
      domain Demo {
        state { mode: "ship" | "pickup" = "ship" }

        computed carrier = argmax(
          ["pickup", eq(mode, "pickup"), 100],
          ["ship", eq(mode, "ship"), 80],
          "first"
        )

        computed tier = match(
          coalesce(carrier, "manual"),
          ["pickup", "pickup"],
          ["ship", "ship"],
          "manual"
        )
      }
    `);

    expect(result.success).toBe(true);
  });

  it("keeps coalesce nullable when every branch may be null", () => {
    const result = compileSource(`
      domain Demo {
        state {
          primary: string | null = null
          secondary: string | null = null
          chosen: string = ""
        }

        action copy() {
          when true {
            patch chosen = coalesce(primary, secondary)
          }
        }
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("accepts typed values(record) mapping for direct array assignment", () => {
    const result = compileSource(`
      domain Demo {
        type Item = { id: string, qty: number }
        type Line = { id: string, qty: number }

        state {
          items: Record<string, Item> = {}
          lines: Array<Line> = []
        }

        action copy() {
          when true {
            patch lines = map(values(items), {
              id: $item.id,
              qty: $item.qty
            })
          }
        }
      }
    `);

    expect(result.success).toBe(true);
  });

  it("rejects mistyped values(record) mapping for direct array assignment", () => {
    const result = compileSource(`
      domain Demo {
        type Item = { id: string, qty: number }
        type Line = { id: string, qty: number }

        state {
          items: Record<string, Item> = {}
          lines: Array<Line> = []
        }

        action copy() {
          when true {
            patch lines = map(values(items), {
              id: 1,
              qty: "x"
            })
          }
        }
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("accepts typed values(record) mapping nested inside object literals", () => {
    const result = compileSource(`
      domain Demo {
        type Item = { id: string, qty: number }
        type Line = { id: string, qty: number }
        type Order = { id: string, lines: Array<Line> }

        state {
          items: Record<string, Item> = {}
          orders: Record<string, Order> = {}
        }

        action submit(orderId: string) {
          when true {
            patch orders[orderId] = {
              id: orderId,
              lines: map(values(items), {
                id: $item.id,
                qty: $item.qty
              })
            }
          }
        }
      }
    `);

    expect(result.success).toBe(true);
  });

  it("accepts argmax results as non-null when candidate eligibility is exhaustively covered", () => {
    const result = compileSource(`
      domain Demo {
        state {
          mode: "ship" | "pickup" = "ship"
          note: string = ""
        }

        computed carrier = argmax(
          ["pickup", eq(mode, "pickup"), 100],
          ["ship", eq(mode, "ship"), 80],
          "first"
        )

        computed tier = match(
          carrier,
          ["pickup", "pickup"],
          ["ship", "ship"],
          "manual"
        )

        action remember() {
          when true {
            patch note = carrier
          }
        }
      }
    `);

    expect(result.success).toBe(true);
  });

  it("keeps argmax results nullable when candidate eligibility is not exhaustively covered", () => {
    const result = compileSource(`
      domain Demo {
        state {
          flag: boolean = false
          note: string = ""
        }

        computed carrier = argmax(
          ["a", flag, 1],
          ["b", false, 0],
          "first"
        )

        computed tier = match(
          carrier,
          ["a", "A"],
          ["b", "B"],
          "manual"
        )

        action remember() {
          when true {
            patch note = carrier
          }
        }
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("keeps argmax results nullable when literal-union coverage is incomplete", () => {
    const result = compileSource(`
      domain Demo {
        state {
          mode: "ship" | "pickup" | "digital" = "ship"
          note: string = ""
        }

        computed carrier = argmax(
          ["pickup", eq(mode, "pickup"), 100],
          ["ship", eq(mode, "ship"), 80],
          "first"
        )

        computed tier = match(
          carrier,
          ["pickup", "pickup"],
          ["ship", "ship"],
          "manual"
        )

        action remember() {
          when true {
            patch note = carrier
          }
        }
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("keeps argmax results nullable when predicates read through nullable property access", () => {
    const result = compileSource(`
      domain Demo {
        type Selection = { mode: "ship" | "pickup" }

        state {
          selection: Selection | null = null
          note: string = ""
        }

        computed carrier = argmax(
          ["pickup", eq(selection.mode, "pickup"), 100],
          ["ship", eq(selection.mode, "ship"), 80],
          "first"
        )

        action remember() {
          when true {
            patch note = carrier
          }
        }
      }
    `);

    expect(result.success).toBe(false);
    expect(result.errors.some((diagnostic) => diagnostic.code === "E_TYPE_MISMATCH")).toBe(true);
  });

  it("accepts argmin results as non-null when candidate eligibility is exhaustively covered", () => {
    const result = compileSource(`
      domain Demo {
        state {
          mode: "pickup" | "ship" = "ship"
          note: string = ""
        }

        computed carrier = argmin(
          ["pickup", eq(mode, "pickup"), 100],
          ["ship", eq(mode, "ship"), 80],
          "first"
        )

        computed tier = match(
          carrier,
          ["pickup", "pickup"],
          ["ship", "ship"],
          "manual"
        )

        action remember() {
          when true {
            patch note = carrier
          }
        }
      }
    `);

    expect(result.success).toBe(true);
  });

  it("accepts the CommerceFulfillmentEngine preferredCarrier pattern without explicit fallback", () => {
    const result = compileSource(`
      domain Demo {
        state {
          fulfillmentMode: "ship" | "pickup" = "ship"
          shippingCountry: "KR" | "US" = "KR"
          note: string = ""
        }

        computed preferredCarrier = argmax(
          ["pickup", eq(fulfillmentMode, "pickup"), 100],
          ["domestic_ship", and(eq(fulfillmentMode, "ship"), eq(shippingCountry, "KR")), 80],
          ["international_ship", and(eq(fulfillmentMode, "ship"), neq(shippingCountry, "KR")), 60],
          "first"
        )

        computed fulfillmentTier = match(
          preferredCarrier,
          ["pickup", "pickup"],
          ["domestic_ship", "standard"],
          ["international_ship", "review"],
          "manual"
        )

        action remember() {
          when true {
            patch note = preferredCarrier
          }
        }
      }
    `);

    expect(result.success).toBe(true);
  });
});
