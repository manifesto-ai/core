/**
 * createManifestoApp Integration Tests
 *
 * Tests the full React lifecycle with real Host/World/Bridge integration.
 * These tests use actual domain definitions to verify that:
 * - Initial state renders correctly
 * - Actions dispatch and trigger UI updates
 * - Computed values update correctly
 * - StrictMode compatibility
 */
import { describe, it, expect, afterEach, vi, beforeAll, afterAll } from "vitest";
import React, { StrictMode } from "react";
import { render, screen, waitFor, cleanup, fireEvent, act } from "@testing-library/react";
import { z } from "zod";
import { defineDomain, type DomainOutput, type Expr, type FieldRef } from "@manifesto-ai/builder";
import { validate } from "@manifesto-ai/core";
import { createManifestoApp } from "../factory/create-app.js";

// ============================================================================
// Test Domain - Simple counter with computed values
// ============================================================================

const CounterSchema = z.object({
  count: z.number(),
  items: z.array(z.string()),
});

type CounterState = z.infer<typeof CounterSchema>;

// Suppress console.log during tests
let originalConsoleLog: typeof console.log;
beforeAll(() => {
  originalConsoleLog = console.log;
  console.log = vi.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

// ============================================================================
// Test Helpers
// ============================================================================

function createTestDomain() {
  const domain = defineDomain(
    CounterSchema,
    ({ state, computed, actions, expr, flow }): DomainOutput => {
      // Define computed values
      const { doubleCount, itemCount } = computed.define({
        doubleCount: expr.mul(state.count, 2),
        itemCount: expr.len(state.items),
      });

      // Define actions
      const { increment, decrement, addItem } = actions.define({
        increment: {
          flow: flow.patch(state.count).set(expr.add(state.count, 1)),
        },
        decrement: {
          flow: flow.patch(state.count).set(expr.sub(state.count, 1)),
        },
        addItem: {
          input: z.object({ item: z.string() }),
          flow: flow.patch(state.items).set(
            expr.append(state.items, expr.input<string>("item"))
          ),
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {
        computed: { doubleCount, itemCount },
        actions: { increment, decrement, addItem },
      } as any;
    },
    { id: "manifesto:test-counter", version: "1.0.0" }
  );

  const validation = validate(domain.schema);
  if (!validation.valid) {
    throw new Error(`Invalid test domain schema: ${JSON.stringify(validation.errors)}`);
  }

  return domain;
}

const initialState: CounterState = { count: 0, items: [] };

// ============================================================================
// Tests
// ============================================================================

describe("createManifestoApp", () => {
  afterEach(() => {
    cleanup();
  });

  describe("basic rendering", () => {
    it("should render with initial state", async () => {
      const TestDomain = createTestDomain();
      const App = createManifestoApp(TestDomain, { initialState });

      function TestComponent() {
        const count = App.useValue((s) => s.count);
        return <span data-testid="count">{count}</span>;
      }

      render(
        <App.Provider>
          <TestComponent />
        </App.Provider>
      );

      // Wait for async initialization
      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("0");
      });
    });

    it("should render computed values", async () => {
      const TestDomain = createTestDomain();
      const App = createManifestoApp(TestDomain, {
        initialState: { count: 5, items: ["a", "b"] },
      });

      function TestComponent() {
        const doubleCount = App.useComputed((c) => c.doubleCount) as number;
        const itemCount = App.useComputed((c) => c.itemCount) as number;
        return (
          <div>
            <span data-testid="double">{doubleCount}</span>
            <span data-testid="items">{itemCount}</span>
          </div>
        );
      }

      render(
        <App.Provider>
          <TestComponent />
        </App.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("double").textContent).toBe("10");
        expect(screen.getByTestId("items").textContent).toBe("2");
      });
    });
  });

  describe("action dispatch and UI updates", () => {
    it("should update UI when action is dispatched", async () => {
      const TestDomain = createTestDomain();
      const App = createManifestoApp(TestDomain, { initialState });

      function TestComponent() {
        const count = App.useValue((s) => s.count);
        const { increment } = App.useActions() as { increment: () => Promise<void> };

        return (
          <div>
            <span data-testid="count">{count}</span>
            <button data-testid="increment" onClick={() => increment()}>
              +
            </button>
          </div>
        );
      }

      render(
        <App.Provider>
          <TestComponent />
        </App.Provider>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("0");
      });

      // Click increment button
      await act(async () => {
        fireEvent.click(screen.getByTestId("increment"));
      });

      // UI should update - THIS IS THE KEY TEST
      await waitFor(
        () => {
          expect(screen.getByTestId("count").textContent).toBe("1");
        },
        { timeout: 3000 }
      );
    });

    it("should update computed values when state changes", async () => {
      const TestDomain = createTestDomain();
      const App = createManifestoApp(TestDomain, { initialState });

      function TestComponent() {
        const count = App.useValue((s) => s.count);
        const doubleCount = App.useComputed((c) => c.doubleCount) as number;
        const { increment } = App.useActions() as { increment: () => Promise<void> };

        return (
          <div>
            <span data-testid="count">{count}</span>
            <span data-testid="double">{doubleCount}</span>
            <button data-testid="increment" onClick={() => increment()}>
              +
            </button>
          </div>
        );
      }

      render(
        <App.Provider>
          <TestComponent />
        </App.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("0");
        expect(screen.getByTestId("double").textContent).toBe("0");
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("increment"));
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("count").textContent).toBe("1");
          expect(screen.getByTestId("double").textContent).toBe("2");
        },
        { timeout: 3000 }
      );
    });

    it("should handle action with input", async () => {
      const TestDomain = createTestDomain();
      const App = createManifestoApp(TestDomain, { initialState });

      function TestComponent() {
        const items = App.useValue((s) => s.items);
        const { addItem } = App.useActions();

        return (
          <div>
            <span data-testid="count">{items.length}</span>
            <button data-testid="add" onClick={() => addItem({ item: "test" })}>
              Add
            </button>
          </div>
        );
      }

      render(
        <App.Provider>
          <TestComponent />
        </App.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("0");
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("add"));
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("count").textContent).toBe("1");
        },
        { timeout: 3000 }
      );
    });

    it("should handle multiple rapid dispatches", async () => {
      const TestDomain = createTestDomain();
      const App = createManifestoApp(TestDomain, { initialState });

      function TestComponent() {
        const count = App.useValue((s) => s.count);
        const { increment } = App.useActions() as { increment: () => Promise<void> };

        return (
          <div>
            <span data-testid="count">{count}</span>
            <button data-testid="increment" onClick={() => increment()}>
              +
            </button>
          </div>
        );
      }

      render(
        <App.Provider>
          <TestComponent />
        </App.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("0");
      });

      // Click 3 times rapidly
      await act(async () => {
        fireEvent.click(screen.getByTestId("increment"));
        fireEvent.click(screen.getByTestId("increment"));
        fireEvent.click(screen.getByTestId("increment"));
      });

      // Should eventually show 3
      await waitFor(
        () => {
          expect(screen.getByTestId("count").textContent).toBe("3");
        },
        { timeout: 5000 }
      );
    });
  });

  describe("StrictMode compatibility", () => {
    it("should work correctly with React.StrictMode", async () => {
      const TestDomain = createTestDomain();
      const App = createManifestoApp(TestDomain, { initialState });

      function TestComponent() {
        const count = App.useValue((s) => s.count);
        const { increment } = App.useActions() as { increment: () => Promise<void> };

        return (
          <div>
            <span data-testid="count">{count}</span>
            <button data-testid="increment" onClick={() => increment()}>
              +
            </button>
          </div>
        );
      }

      render(
        <StrictMode>
          <App.Provider>
            <TestComponent />
          </App.Provider>
        </StrictMode>
      );

      // Wait for initialization (may take longer due to double-invoke)
      await waitFor(
        () => {
          expect(screen.getByTestId("count").textContent).toBe("0");
        },
        { timeout: 3000 }
      );

      // Dispatch action
      await act(async () => {
        fireEvent.click(screen.getByTestId("increment"));
      });

      // Should still work
      await waitFor(
        () => {
          expect(screen.getByTestId("count").textContent).toBe("1");
        },
        { timeout: 3000 }
      );
    });
  });

  describe("hooks", () => {
    it("useValue should return correct value", async () => {
      const TestDomain = createTestDomain();
      const App = createManifestoApp(TestDomain, {
        initialState: { count: 42, items: [] },
      });

      function TestComponent() {
        const count = App.useValue((s) => s.count);
        return <span data-testid="count">{count}</span>;
      }

      render(
        <App.Provider>
          <TestComponent />
        </App.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("42");
      });
    });

    it("useComputed should return correct computed value", async () => {
      const TestDomain = createTestDomain();
      const App = createManifestoApp(TestDomain, {
        initialState: { count: 7, items: [] },
      });

      function TestComponent() {
        const doubleCount = App.useComputed((c) => c.doubleCount) as number;
        return <span data-testid="double">{doubleCount}</span>;
      }

      render(
        <App.Provider>
          <TestComponent />
        </App.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("double").textContent).toBe("14");
      });
    });

    it("useActions should return all actions", async () => {
      const TestDomain = createTestDomain();
      const App = createManifestoApp(TestDomain, { initialState });

      function TestComponent() {
        const actions = App.useActions();
        return (
          <div>
            <span data-testid="has-increment">{typeof actions.increment === "function" ? "yes" : "no"}</span>
            <span data-testid="has-decrement">{typeof actions.decrement === "function" ? "yes" : "no"}</span>
            <span data-testid="has-addItem">{typeof actions.addItem === "function" ? "yes" : "no"}</span>
          </div>
        );
      }

      render(
        <App.Provider>
          <TestComponent />
        </App.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("has-increment").textContent).toBe("yes");
        expect(screen.getByTestId("has-decrement").textContent).toBe("yes");
        expect(screen.getByTestId("has-addItem").textContent).toBe("yes");
      });
    });

    it("useBridge should return bridge instance", async () => {
      const TestDomain = createTestDomain();
      const App = createManifestoApp(TestDomain, { initialState });

      function TestComponent() {
        const bridge = App.useBridge();
        return <span data-testid="has-bridge">{bridge ? "yes" : "no"}</span>;
      }

      render(
        <App.Provider>
          <TestComponent />
        </App.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("has-bridge").textContent).toBe("yes");
      });
    });
  });

  describe("error handling", () => {
    it("should throw when using hooks outside Provider", () => {
      const TestDomain = createTestDomain();
      const App = createManifestoApp(TestDomain, { initialState });

      function TestComponent() {
        App.useValue((s) => s.count);
        return <div>Should not render</div>;
      }

      expect(() => {
        render(<TestComponent />);
      }).toThrow("useValue/useComputed/useActions must be used within ManifestoApp.Provider");
    });
  });

  describe("filter switching (regression test)", () => {
    // Test domain with filter state (simulates todo app)
    const FilterSchema = z.object({
      filter: z.enum(["all", "active", "completed"]),
      items: z.array(z.object({
        id: z.string(),
        completed: z.boolean(),
      })),
    });

    type FilterState = z.infer<typeof FilterSchema>;
    type FilterType = "all" | "active" | "completed";

    function createFilterDomain() {
      const domain = defineDomain(
        FilterSchema,
        ({ state, computed, actions, expr, flow }): DomainOutput => {
          // Helper to convert ItemProxy property to Expr (workaround for type system)
          // Using function declaration to avoid JSX parsing issues with generic arrow functions
          function itemField<T>(proxy: unknown): Expr<T> {
            return expr.get(proxy as unknown as FieldRef<T>);
          }

          // Filtered items based on current filter
          const { filteredItems } = computed.define({
            filteredItems: expr.cond(
              expr.eq(state.filter, "active"),
              expr.filter(state.items, (item) =>
                expr.not(itemField<boolean>(item.completed))
              ),
              expr.cond(
                expr.eq(state.filter, "completed"),
                expr.filter(state.items, (item) =>
                  itemField<boolean>(item.completed)
                ),
                state.items
              )
            ),
          });

          const { setFilter, addItem } = actions.define({
            setFilter: {
              input: z.object({ filter: z.enum(["all", "active", "completed"]) }),
              flow: flow.patch(state.filter).set(expr.input<FilterType>("filter")),
            },
            addItem: {
              input: z.object({ id: z.string(), completed: z.boolean() }),
              flow: flow.patch(state.items).set(
                expr.append(state.items, expr.object({
                  id: expr.input<string>("id"),
                  completed: expr.input<boolean>("completed"),
                }))
              ),
            },
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return {
            computed: { filteredItems },
            actions: { setFilter, addItem },
          } as any;
        },
        { id: "manifesto:test-filter", version: "1.0.0" }
      );

      const validation = validate(domain.schema);
      if (!validation.valid) {
        throw new Error(`Invalid filter domain schema: ${JSON.stringify(validation.errors)}`);
      }

      return domain;
    }

    const filterInitialState: FilterState = {
      filter: "all",
      items: [
        { id: "1", completed: false },
        { id: "2", completed: true },
        { id: "3", completed: false },
      ],
    };

    it("should update filter state when setFilter is called", async () => {
      const FilterDomain = createFilterDomain();
      const App = createManifestoApp(FilterDomain, { initialState: filterInitialState });

      function TestComponent() {
        const filter = App.useValue((s) => s.filter);
        const { setFilter } = App.useActions() as {
          setFilter: (input: { filter: FilterType }) => Promise<void>
        };

        return (
          <div>
            <span data-testid="filter">{filter}</span>
            <button data-testid="set-all" onClick={() => setFilter({ filter: "all" })}>All</button>
            <button data-testid="set-active" onClick={() => setFilter({ filter: "active" })}>Active</button>
            <button data-testid="set-completed" onClick={() => setFilter({ filter: "completed" })}>Completed</button>
          </div>
        );
      }

      render(
        <App.Provider>
          <TestComponent />
        </App.Provider>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByTestId("filter").textContent).toBe("all");
      });

      // Change to active
      await act(async () => {
        fireEvent.click(screen.getByTestId("set-active"));
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("filter").textContent).toBe("active");
        },
        { timeout: 3000 }
      );

      // Change to completed
      await act(async () => {
        fireEvent.click(screen.getByTestId("set-completed"));
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("filter").textContent).toBe("completed");
        },
        { timeout: 3000 }
      );

      // CRITICAL: Change back to all - this is where the bug occurs
      await act(async () => {
        fireEvent.click(screen.getByTestId("set-all"));
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("filter").textContent).toBe("all");
        },
        { timeout: 3000 }
      );

      // One more cycle to confirm
      await act(async () => {
        fireEvent.click(screen.getByTestId("set-active"));
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("filter").textContent).toBe("active");
        },
        { timeout: 3000 }
      );
    });

    it("should update filteredItems computed when filter changes multiple times", async () => {
      const FilterDomain = createFilterDomain();
      const App = createManifestoApp(FilterDomain, { initialState: filterInitialState });

      function TestComponent() {
        const filter = App.useValue((s) => s.filter);
        const filteredItems = App.useComputed((c) => c.filteredItems) as Array<{ id: string; completed: boolean }>;
        const { setFilter } = App.useActions() as {
          setFilter: (input: { filter: FilterType }) => Promise<void>
        };

        return (
          <div>
            <span data-testid="filter">{filter}</span>
            <span data-testid="count">{filteredItems.length}</span>
            <button data-testid="set-all" onClick={() => setFilter({ filter: "all" })}>All</button>
            <button data-testid="set-active" onClick={() => setFilter({ filter: "active" })}>Active</button>
            <button data-testid="set-completed" onClick={() => setFilter({ filter: "completed" })}>Completed</button>
          </div>
        );
      }

      render(
        <App.Provider>
          <TestComponent />
        </App.Provider>
      );

      // all: 3 items
      await waitFor(() => {
        expect(screen.getByTestId("filter").textContent).toBe("all");
        expect(screen.getByTestId("count").textContent).toBe("3");
      });

      // active: 2 items (id 1 and 3 are not completed)
      await act(async () => {
        fireEvent.click(screen.getByTestId("set-active"));
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("filter").textContent).toBe("active");
          expect(screen.getByTestId("count").textContent).toBe("2");
        },
        { timeout: 3000 }
      );

      // completed: 1 item (id 2 is completed)
      await act(async () => {
        fireEvent.click(screen.getByTestId("set-completed"));
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("filter").textContent).toBe("completed");
          expect(screen.getByTestId("count").textContent).toBe("1");
        },
        { timeout: 3000 }
      );

      // CRITICAL: Back to all - should show 3 items again
      await act(async () => {
        fireEvent.click(screen.getByTestId("set-all"));
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("filter").textContent).toBe("all");
          expect(screen.getByTestId("count").textContent).toBe("3");
        },
        { timeout: 3000 }
      );

      // Another cycle: active again
      await act(async () => {
        fireEvent.click(screen.getByTestId("set-active"));
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("filter").textContent).toBe("active");
          expect(screen.getByTestId("count").textContent).toBe("2");
        },
        { timeout: 3000 }
      );
    });
  });
});
