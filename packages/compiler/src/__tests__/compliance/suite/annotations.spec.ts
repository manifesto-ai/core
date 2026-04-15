import { describe, it } from "vitest";
import { createManifesto } from "../../../../../sdk/src/index.js";
import { buildAnnotationIndex } from "../../../annotations.js";
import { compileMelDomain, compileMelModule } from "../../../api/index.js";
import {
  diagnosticEvidence,
  evaluateRule,
  expectAllCompliance,
  hasDiagnosticCode,
  noteEvidence,
} from "../ccts-assertions.js";
import { CCTS_CASES, caseTitle } from "../ccts-coverage.js";
import { getRuleOrThrow } from "../ccts-rules.js";
import { parse } from "../../../parser/index.js";
import { tokenize } from "../../../lexer/index.js";
import { extractSchemaGraph } from "../../../schema-graph.js";

type AnnotationInvariantDomain = {
  actions: {
    archive: (limit: number) => Promise<void>;
  };
  state: {
    count: number;
  };
  computed: {
    canArchive: boolean;
  };
};

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
      count: number = 0
    }

    @meta("ui:panel")
    @meta("ui:panel")
    @meta("ui:status", { variant: "compact" })
    computed canArchive = lt(count, 2)

    @meta("ui:button", { variant: "secondary" })
    action archive(limit: number)
      available when canArchive
      dispatchable when lt(count, limit) {
      when true { patch count = add(count, 1) }
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
      count: number = 0
    }

    computed canArchive = lt(count, 2)

    action archive(limit: number)
      available when canArchive
      dispatchable when lt(count, limit) {
      when true { patch count = add(count, 1) }
    }
  }
`;

describe("CCTS Annotation Suite", () => {
  it(caseTitle(CCTS_CASES.ANNOTATIONS_SURFACE, "(META-1/META-2/META-5/META-7/META-8/META-9/META-10) annotation sidecar surface is enforced"), () => {
    const first = compileMelModule(ANNOTATED_SOURCE, { mode: "module" });
    const second = compileMelModule(ANNOTATED_SOURCE, { mode: "module" });
    const namespaceBlind = compileMelModule(`
      @meta("acme:unknown", { enabled: true })
      domain Demo {
        state { count: number = 0 }
        @meta("vendor:action")
        action increment() {
          when true { patch count = add(count, 1) }
        }
      }
    `, { mode: "module" });

    const parsed = parse(tokenize(ANNOTATED_SOURCE).tokens);
    const tamperedIndex = first.module && parsed.program
      ? buildAnnotationIndex(parsed.program, {
        ...first.module.schema,
        actions: {},
      })
      : null;

    const firstModule = first.module;
    const secondModule = second.module;
    const sortedKeys = firstModule ? Object.keys(firstModule.annotations.entries) : [];
    const noEmptyArrays = firstModule
      ? Object.values(firstModule.annotations.entries).every((entry) => entry.length > 0)
      : false;

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("META-1"), namespaceBlind.errors.length === 0, {
        passMessage: "Unknown annotation namespaces compile without compiler-owned semantic interpretation.",
        failMessage: "Compiler no longer treats annotation tags as opaque strings.",
        evidence: diagnosticEvidence(namespaceBlind.errors),
      }),
      evaluateRule(getRuleOrThrow("META-2"), Boolean(firstModule)
        && !("annotations" in firstModule.schema)
        && JSON.stringify(firstModule.graph) === JSON.stringify(extractSchemaGraph(firstModule.schema)), {
        passMessage: "Annotations stay outside DomainSchema and SchemaGraph.",
        failMessage: "Annotations leaked into semantic compiler artifacts.",
        evidence: firstModule ? [
          noteEvidence("Annotation entry keys", sortedKeys),
        ] : diagnosticEvidence(first.errors),
      }),
      evaluateRule(getRuleOrThrow("META-5"), Boolean(tamperedIndex)
        && hasDiagnosticCode(tamperedIndex!.diagnostics, "E057"), {
        passMessage: "Annotation targets are validated against emitted DomainSchema structure.",
        failMessage: "Target validation no longer reports dangling annotation targets.",
        evidence: tamperedIndex ? diagnosticEvidence(tamperedIndex.diagnostics) : diagnosticEvidence(first.errors),
      }),
      evaluateRule(getRuleOrThrow("META-7"), namespaceBlind.errors.length === 0, {
        passMessage: "Namespace-specific semantics remain consumer-owned.",
        failMessage: "Compiler started rejecting unknown annotation vocabularies.",
        evidence: diagnosticEvidence(namespaceBlind.errors),
      }),
      evaluateRule(getRuleOrThrow("META-8"), Boolean(firstModule)
        && JSON.stringify(firstModule.annotations.entries["computed:canArchive"]) === JSON.stringify([
          { tag: "ui:panel" },
          { tag: "ui:panel" },
          { tag: "ui:status", payload: { variant: "compact" } },
        ]), {
        passMessage: "Stacked annotations preserve source order and repeated tags.",
        failMessage: "Same-target annotation ordering or duplicate preservation regressed.",
        evidence: firstModule ? [
          noteEvidence("Computed annotations", firstModule.annotations.entries["computed:canArchive"]),
        ] : diagnosticEvidence(first.errors),
      }),
      evaluateRule(getRuleOrThrow("META-9"), Boolean(firstModule)
        && firstModule.annotations.schemaHash === firstModule.schema.hash, {
        passMessage: "AnnotationIndex.schemaHash matches DomainSchema.hash.",
        failMessage: "AnnotationIndex.schemaHash no longer aligns with the emitted DomainSchema hash.",
        evidence: firstModule ? [
          noteEvidence("Annotation schema hash", firstModule.annotations.schemaHash),
          noteEvidence("Schema hash", firstModule.schema.hash),
        ] : diagnosticEvidence(first.errors),
      }),
      evaluateRule(getRuleOrThrow("META-10"), Boolean(firstModule && secondModule)
        && JSON.stringify(firstModule.annotations) === JSON.stringify(secondModule.annotations)
        && noEmptyArrays, {
        passMessage: "Annotation sidecar emission is deterministic and omits empty targets.",
        failMessage: "Annotation sidecar emission is unstable or includes empty target entries.",
        evidence: firstModule ? [
          noteEvidence("Annotation entry keys", sortedKeys),
        ] : diagnosticEvidence(first.errors),
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.ANNOTATIONS_PAYLOAD, "(META-6) annotation payload constraints are enforced"), () => {
    const valid = compileMelModule(ANNOTATED_SOURCE, { mode: "module" });
    const invalidExpr = compileMelDomain(`
      domain Demo {
        state {
          items: Array<string> = []
          count: number = 0
        }

        @meta("ui:button", { disabled: eq(len(items), 0) })
        action archive() {
          when true { patch count = add(count, 1) }
        }
      }
    `, { mode: "domain" });
    const invalidDepth = compileMelDomain(`
      domain Demo {
        state { count: number = 0 }

        @meta("ui:card", { config: { pricing: { free: "$0" } } })
        computed cardVariant = count
      }
    `, { mode: "domain" });

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("META-6"), valid.errors.length === 0
        && hasDiagnosticCode(invalidExpr.errors, "E055")
        && hasDiagnosticCode(invalidDepth.errors, "E056"), {
        passMessage: "Annotation payloads remain literal-only with the current depth cap.",
        failMessage: "Annotation payload validation no longer enforces literal-only payloads and depth bounds.",
        evidence: [
          ...diagnosticEvidence(invalidExpr.errors),
          ...diagnosticEvidence(invalidDepth.errors),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.ANNOTATIONS_INVARIANTS, "(META-3/INV-META-1..5) annotation erasure invariants are enforced"), async () => {
    const annotatedSchema = compileMelDomain(ANNOTATED_SOURCE, { mode: "domain" });
    const strippedSchema = compileMelDomain(STRIPPED_SOURCE, { mode: "domain" });
    const annotated = createManifesto<AnnotationInvariantDomain>(annotatedSchema.schema!, {}).activate();
    const stripped = createManifesto<AnnotationInvariantDomain>(strippedSchema.schema!, {}).activate();
    const annotatedIntent = annotated.createIntent(annotated.MEL.actions.archive, 2);
    const strippedIntent = stripped.createIntent(stripped.MEL.actions.archive, 2);

    const sameSchema = JSON.stringify(annotatedSchema.schema) === JSON.stringify(strippedSchema.schema);
    const sameGraph = JSON.stringify(extractSchemaGraph(annotatedSchema.schema!)) === JSON.stringify(extractSchemaGraph(strippedSchema.schema!));
    const sameDispatchability = annotated.isIntentDispatchable(annotated.MEL.actions.archive, 2) === stripped.isIntentDispatchable(stripped.MEL.actions.archive, 2);
    const sameAvailability = JSON.stringify(annotated.getAvailableActions()) === JSON.stringify(stripped.getAvailableActions());
    const sameBlockers = JSON.stringify(annotated.getIntentBlockers(annotated.MEL.actions.archive, 2)) === JSON.stringify(stripped.getIntentBlockers(stripped.MEL.actions.archive, 2));

    await annotated.dispatchAsync(annotatedIntent);
    await stripped.dispatchAsync(strippedIntent);

    const annotatedAvailableActions = annotated.getAvailableActions();
    const strippedAvailableActions = stripped.getAvailableActions();
    const annotatedBlockers = annotated.getIntentBlockers(annotated.MEL.actions.archive, 2);
    const strippedBlockers = stripped.getIntentBlockers(stripped.MEL.actions.archive, 2);
    const annotatedSnapshot = annotated.getSnapshot();
    const strippedSnapshot = stripped.getSnapshot();
    const sameSnapshots = JSON.stringify(annotatedSnapshot) === JSON.stringify(strippedSnapshot);

    annotated.dispose();
    stripped.dispose();

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("META-3"), sameSchema && sameGraph && sameDispatchability && sameAvailability && sameSnapshots, {
        passMessage: "Structural annotations have zero semantic influence on runtime behavior.",
        failMessage: "Structural annotations changed runtime semantics or emitted semantic artifacts.",
        evidence: [
          noteEvidence("Same schema", sameSchema),
          noteEvidence("Same graph", sameGraph),
          noteEvidence("Same availability", sameAvailability),
          noteEvidence("Same dispatchability", sameDispatchability),
          noteEvidence("Same blockers", sameBlockers),
          noteEvidence("Same snapshots after dispatch", sameSnapshots),
        ],
      }),
      evaluateRule(getRuleOrThrow("INV-META-1"), sameSchema, {
        passMessage: "Removing @meta leaves DomainSchema byte-identical.",
        failMessage: "Removing @meta changed the emitted DomainSchema.",
        evidence: [
          noteEvidence("Annotated schema hash", annotatedSchema.schema?.hash ?? null),
          noteEvidence("Stripped schema hash", strippedSchema.schema?.hash ?? null),
        ],
      }),
      evaluateRule(getRuleOrThrow("INV-META-2"), sameGraph, {
        passMessage: "Removing @meta leaves SchemaGraph identical.",
        failMessage: "Removing @meta changed SchemaGraph projection.",
        evidence: [
          noteEvidence("Annotated graph node count", extractSchemaGraph(annotatedSchema.schema!).nodes.length),
          noteEvidence("Stripped graph node count", extractSchemaGraph(strippedSchema.schema!).nodes.length),
        ],
      }),
      evaluateRule(getRuleOrThrow("INV-META-3"), sameSnapshots, {
        passMessage: "compute()/dispatch results remain identical with or without annotations.",
        failMessage: "compute()/dispatch results changed when annotations were present.",
        evidence: [
          noteEvidence("Annotated snapshot", annotatedSnapshot),
          noteEvidence("Stripped snapshot", strippedSnapshot),
        ],
      }),
      evaluateRule(getRuleOrThrow("INV-META-4"), sameAvailability, {
        passMessage: "getAvailableActions() remains identical with or without annotations.",
        failMessage: "getAvailableActions() changed when annotations were present.",
        evidence: [
          noteEvidence("Annotated available actions", annotatedAvailableActions),
          noteEvidence("Stripped available actions", strippedAvailableActions),
        ],
      }),
      evaluateRule(getRuleOrThrow("INV-META-5"), sameDispatchability && sameBlockers, {
        passMessage: "Intent dispatchability remains identical with or without annotations.",
        failMessage: "Intent dispatchability changed when annotations were present.",
        evidence: [
          noteEvidence("Annotated blockers", annotatedBlockers),
          noteEvidence("Stripped blockers", strippedBlockers),
        ],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.ANNOTATIONS_RUNTIME_BOUNDARY, "(META-4/INV-META-6) DomainModule runtime-boundary guards are enforced"), () => {
    const result = compileMelModule(ANNOTATED_SOURCE, { mode: "module" });

    let rejected = false;
    let message = "";
    try {
      createManifesto(
        result.module as never,
        {},
      );
    } catch (error) {
      rejected = true;
      message = error instanceof Error ? error.message : String(error);
    }

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("META-4"), rejected, {
        passMessage: "Runtime entrypoints reject DomainModule tooling artifacts.",
        failMessage: "Runtime entrypoints accepted a tooling-only DomainModule artifact.",
        evidence: [noteEvidence("Runtime rejection message", message)],
      }),
      evaluateRule(getRuleOrThrow("INV-META-6"), rejected, {
        passMessage: "DomainModule is not accepted by createManifesto().",
        failMessage: "DomainModule reached createManifesto() without rejection.",
        evidence: [noteEvidence("Runtime rejection message", message)],
      }),
    ]);
  });

  it(caseTitle(CCTS_CASES.ANNOTATIONS_DIAGNOSTICS, "(E053-E057) annotation diagnostic families are enforced"), () => {
    const invalidPlacement = compileMelDomain(`
      domain Demo {
        state { count: number = 0 }
        action increment() {
          @meta("ui:button")
          when true { patch count = add(count, 1) }
        }
      }
    `, { mode: "domain" });
    const invalidParam = compileMelDomain(`
      domain Demo {
        state { nextDueDate: string = "" }
        action create(@meta("ui:date-picker") dueDate: string) {
          when true { patch nextDueDate = dueDate }
        }
      }
    `, { mode: "domain" });
    const invalidPayload = compileMelDomain(`
      domain Demo {
        state {
          items: Array<string> = []
          count: number = 0
        }
        @meta("ui:button", { disabled: eq(len(items), 0) })
        action archive() {
          when true { patch count = add(count, 1) }
        }
      }
    `, { mode: "domain" });
    const invalidDepth = compileMelDomain(`
      domain Demo {
        state { count: number = 0 }
        @meta("ui:card", { config: { pricing: { free: "$0" } } })
        computed cardVariant = count
      }
    `, { mode: "domain" });

    const parsed = parse(tokenize(ANNOTATED_SOURCE).tokens);
    const moduleResult = compileMelModule(ANNOTATED_SOURCE, { mode: "module" });
    const dangling = moduleResult.module && parsed.program
      ? buildAnnotationIndex(parsed.program, {
        ...moduleResult.module.schema,
        actions: {},
      })
      : null;

    expectAllCompliance([
      evaluateRule(getRuleOrThrow("E053"), hasDiagnosticCode(invalidPlacement.errors, "E053"), {
        passMessage: "Unsupported annotation placement emits E053.",
        failMessage: "Unsupported annotation placement no longer emits E053.",
        evidence: diagnosticEvidence(invalidPlacement.errors),
      }),
      evaluateRule(getRuleOrThrow("E054"), hasDiagnosticCode(invalidParam.errors, "E054"), {
        passMessage: "Action-parameter annotations emit E054.",
        failMessage: "Action-parameter annotations no longer emit E054.",
        evidence: diagnosticEvidence(invalidParam.errors),
      }),
      evaluateRule(getRuleOrThrow("E055"), hasDiagnosticCode(invalidPayload.errors, "E055"), {
        passMessage: "Non-literal annotation payloads emit E055.",
        failMessage: "Non-literal annotation payloads no longer emit E055.",
        evidence: diagnosticEvidence(invalidPayload.errors),
      }),
      evaluateRule(getRuleOrThrow("E056"), hasDiagnosticCode(invalidDepth.errors, "E056"), {
        passMessage: "Annotation payload depth overflow emits E056.",
        failMessage: "Annotation payload depth overflow no longer emits E056.",
        evidence: diagnosticEvidence(invalidDepth.errors),
      }),
      evaluateRule(getRuleOrThrow("E057"), Boolean(dangling) && hasDiagnosticCode(dangling!.diagnostics, "E057"), {
        passMessage: "Dangling annotation targets emit E057.",
        failMessage: "Dangling annotation targets no longer emit E057.",
        evidence: dangling ? diagnosticEvidence(dangling.diagnostics) : diagnosticEvidence(moduleResult.errors),
      }),
    ]);
  });
});
