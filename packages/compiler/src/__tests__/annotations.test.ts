import { describe, expect, it } from "vitest";

import { buildAnnotationIndex } from "../annotations.js";
import { compileMelDomain, compileMelModule } from "../api/index.js";
import { parse } from "../parser/index.js";
import { tokenize } from "../lexer/index.js";
import { extractSchemaGraph } from "../schema-graph.js";

const ANNOTATED_SOURCE = `
  @meta("doc:summary", { area: "tasks" })
  domain TaskBoard {
    @meta("doc:entity")
    type Task = {
      id: string,
      @meta("ui:hidden")
      internalNote: string | null
    }

    state {
      @meta("analytics:track")
      lastArchivedId: string | null = null
    }

    @meta("ui:panel")
    @meta("ui:panel")
    @meta("ui:status", { variant: "compact" })
    computed hasArchivedTask = isNotNull(lastArchivedId)

    @meta("ui:button", { variant: "secondary" })
    action archive(id: string)
      dispatchable when isNull(lastArchivedId) {
      when true {
        patch lastArchivedId = id
      }
    }
  }
`;

const STRIPPED_SOURCE = `
  domain TaskBoard {
    type Task = {
      id: string,
      internalNote: string | null
    }

    state {
      lastArchivedId: string | null = null
    }

    computed hasArchivedTask = isNotNull(lastArchivedId)

    action archive(id: string)
      dispatchable when isNull(lastArchivedId) {
      when true {
        patch lastArchivedId = id
      }
    }
  }
`;

const FLOATING_ANNOTATION_SOURCE = `
  @meta("doc:summary")
`;

describe("structural annotations", () => {
  it("keeps compileMelDomain schema output byte-identical when annotations are present", () => {
    const annotated = compileMelDomain(ANNOTATED_SOURCE, { mode: "domain" });
    const stripped = compileMelDomain(STRIPPED_SOURCE, { mode: "domain" });

    expect(annotated.errors).toEqual([]);
    expect(stripped.errors).toEqual([]);
    expect(JSON.stringify(annotated.schema)).toBe(JSON.stringify(stripped.schema));
  });

  it("emits deterministic AnnotationIndex sidecars through compileMelModule", () => {
    const first = compileMelModule(ANNOTATED_SOURCE, { mode: "module" });
    const second = compileMelModule(ANNOTATED_SOURCE, { mode: "module" });

    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);
    expect(first.module).not.toBeNull();
    expect(second.module).not.toBeNull();

    const firstModule = first.module!;
    const secondModule = second.module!;

    expect(firstModule.annotations.schemaHash).toBe(firstModule.schema.hash);
    expect(firstModule.graph).toEqual(extractSchemaGraph(firstModule.schema));
    expect(firstModule.graph).toEqual(extractSchemaGraph(compileMelDomain(STRIPPED_SOURCE, { mode: "domain" }).schema!));
    expect(JSON.stringify(firstModule.annotations)).toBe(JSON.stringify(secondModule.annotations));
    expect(Object.keys(firstModule.annotations.entries)).toEqual([
      "action:archive",
      "computed:hasArchivedTask",
      "domain:TaskBoard",
      "state_field:lastArchivedId",
      "type:Task",
      "type_field:Task.internalNote",
    ]);
    expect(firstModule.annotations.entries["computed:hasArchivedTask"]).toEqual([
      { tag: "ui:panel" },
      { tag: "ui:panel" },
      { tag: "ui:status", payload: { variant: "compact" } },
    ]);
    expect(Object.isFrozen(firstModule)).toBe(true);
    expect(Object.isFrozen(firstModule.graph)).toBe(true);
    expect(Object.isFrozen(firstModule.annotations)).toBe(true);
    expect(Object.isFrozen(firstModule.annotations.entries)).toBe(true);
    expect(Object.isFrozen(firstModule.annotations.entries["computed:hasArchivedTask"])).toBe(true);
    expect(Object.isFrozen(firstModule.annotations.entries["computed:hasArchivedTask"]?.[2]?.payload)).toBe(true);
  });

  it("remains namespace-blind and accepts unknown annotation vocabularies", () => {
    const result = compileMelModule(`
      @meta("totally:custom", { enabled: true })
      domain Demo {
        state { count: number = 0 }
        @meta("acme:button")
        action increment() {
          when true { patch count = add(count, 1) }
        }
      }
    `, { mode: "module" });

    expect(result.errors).toEqual([]);
    expect(result.module?.annotations.entries).toEqual({
      "action:increment": [{ tag: "acme:button" }],
      "domain:Demo": [{ tag: "totally:custom", payload: { enabled: true } }],
    });
  });

  it("reports E053 for unsupported annotation placement", () => {
    const statementResult = compileMelDomain(`
      domain Demo {
        state { count: number = 0 }
        action increment() {
          @meta("ui:button")
          when true { patch count = add(count, 1) }
        }
      }
    `, { mode: "domain" });

    const nestedFieldResult = compileMelDomain(`
      domain Demo {
        state {
          config: {
            @meta("ui:hidden")
            nested: string
          } = { nested: "x" }
        }
      }
    `, { mode: "domain" });
    const trailingMemberResult = compileMelDomain(`
      domain Demo {
        @meta("ui:button")
      }
    `, { mode: "domain" });
    const floatingTopLevelResult = compileMelDomain(FLOATING_ANNOTATION_SOURCE, { mode: "domain" });

    expect(statementResult.errors.some((error) => error.code === "E053")).toBe(true);
    expect(nestedFieldResult.errors.some((error) => error.code === "E053")).toBe(true);
    expect(trailingMemberResult.errors.some((error) => error.code === "E053")).toBe(true);
    expect(floatingTopLevelResult.errors.some((error) => error.code === "E053")).toBe(true);
  });

  it("reports E054 for action-parameter annotations", () => {
    const result = compileMelDomain(`
      domain Demo {
        state { nextDueDate: string = "" }
        action create(@meta("ui:date-picker") dueDate: string) {
          when true { patch nextDueDate = dueDate }
        }
      }
    `, { mode: "domain" });

    expect(result.errors.some((error) => error.code === "E054")).toBe(true);
  });

  it("reports E055 for non-literal annotation payloads", () => {
    const result = compileMelDomain(`
      domain Demo {
        state {
          items: Array<string> = []
          lastArchivedId: string | null = null
        }

        @meta("ui:button", { disabled: eq(len(items), 0) })
        action archive() {
          when true { patch lastArchivedId = "done" }
        }
      }
    `, { mode: "domain" });

    expect(result.errors.some((error) => error.code === "E055")).toBe(true);
  });

  it("reports E056 for payloads that exceed the v1 nesting limit", () => {
    const result = compileMelDomain(`
      domain Demo {
        state { cardVariant: string = "free" }

        @meta("ui:card", { config: { pricing: { free: "$0" } } })
        computed cardVariantView = cardVariant
      }
    `, { mode: "domain" });

    expect(result.errors.some((error) => error.code === "E056")).toBe(true);
  });

  it("reports E057 when extracted targets do not match the emitted schema", () => {
    const lexed = tokenize(ANNOTATED_SOURCE);
    const parsed = parse(lexed.tokens);
    const compiled = compileMelDomain(ANNOTATED_SOURCE, { mode: "domain" });

    expect(parsed.diagnostics).toEqual([]);
    expect(compiled.errors).toEqual([]);
    expect(parsed.program).not.toBeNull();
    expect(compiled.schema).not.toBeNull();

    const { archive: _archive, ...actions } = compiled.schema!.actions;
    const tamperedSchema = {
      ...compiled.schema!,
      actions,
    };
    const result = buildAnnotationIndex(parsed.program!, tamperedSchema);

    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "E057")).toBe(true);
  });
});
