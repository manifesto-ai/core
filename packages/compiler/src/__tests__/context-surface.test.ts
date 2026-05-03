import { describe, expect, it } from "vitest";
import { compile } from "../index.js";

describe("ADR-027 compiler context surface", () => {
  it("emits DomainSchema.context from a MEL context block", () => {
    const result = compile(`
      domain TenantScoped {
        context {
          tenantId: string
          locale: string
        }
        state { currentTenant: string = "" }
        action bind() {
          when true {
            patch currentTenant = $context.tenantId
          }
        }
      }
    `);

    expect(result.success).toBe(true);
    expect(result.schema?.context?.fields).toHaveProperty("tenantId");
    expect(result.schema?.context?.fieldTypes?.tenantId).toEqual({
      kind: "primitive",
      type: "string",
    });
    expect(JSON.stringify(result.schema?.actions.bind.flow)).toContain("$context.tenantId");
  });

  it("lowers runtime values to Core runtime get paths", () => {
    const result = compile(`
      domain RuntimeBacked {
        state {
          id: string = ""
          createdAt: number = 0
        }
        action create() {
          when true {
            patch id = $runtime.random.uuid
            patch createdAt = $runtime.time.timestamp
          }
        }
      }
    `);

    expect(result.success).toBe(true);
    const flow = JSON.stringify(result.schema?.actions.create.flow);
    expect(flow).toContain("$runtime.random.uuid");
    expect(flow).toContain("$runtime.time.timestamp");
  });

  it("rejects context and runtime reads outside action flow expressions", () => {
    const computedResult = compile(`
      domain BadComputed {
        context { locale: string }
        computed localized = $context.locale
      }
    `);
    const availableResult = compile(`
      domain BadAvailable {
        context { locale: string }
        state { ready: boolean = true }
        action submit() available when eq($context.locale, "ko-KR") {
          when ready { patch ready = false }
        }
      }
    `);
    const dispatchableResult = compile(`
      domain BadDispatchable {
        state { ready: boolean = true }
        action submit()
          dispatchable when eq($runtime.intent.id, "x") {
          when ready { patch ready = false }
        }
      }
    `);

    expect(computedResult.errors.some((error) => error.code === "E001")).toBe(true);
    expect(availableResult.errors.some((error) => error.code === "E005")).toBe(true);
    expect(dispatchableResult.errors.some((error) => error.code === "E047")).toBe(true);
  });

  it("rejects undeclared or unknown context paths", () => {
    const missingContext = compile(`
      domain MissingContext {
        state { tenantId: string = "" }
        action bind() {
          when true { patch tenantId = $context.tenantId }
        }
      }
    `);
    const unknownField = compile(`
      domain UnknownContextField {
        context { tenantId: string }
        state { locale: string = "" }
        action bind() {
          when true { patch locale = $context.locale }
        }
      }
    `);

    expect(missingContext.success).toBe(false);
    expect(missingContext.errors.some((error) => error.code === "E003")).toBe(true);
    expect(unknownField.success).toBe(false);
    expect(unknownField.errors.some((error) => error.code === "E_UNDEFINED")).toBe(true);
  });
});
