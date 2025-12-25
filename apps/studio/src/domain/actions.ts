import {
  defineAction,
  setValue,
  setState,
  type ActionSemanticMeta,
} from "@manifesto-ai/core";
import { z } from "zod";

// Helper for action semantic metadata
const actionSemantic = (
  verb: string,
  description: string,
  opts?: Partial<ActionSemanticMeta>
): ActionSemanticMeta => ({
  type: "action",
  description,
  verb,
  expectedOutcome: description,
  risk: "low",
  ...opts,
});

/**
 * Actions for the Studio domain.
 *
 * Note: Complex object mutations (add/update/remove for sources and derived)
 * are handled directly in components via useSetValue hook with JS object spread,
 * since Expression DSL doesn't support assoc/merge/dissoc operations.
 *
 * These actions cover simple state updates that can be expressed with the DSL.
 */
export const actions = {
  // Domain name - simple string value
  setDomainName: defineAction({
    deps: ["data.domain.name"],
    input: z.object({ name: z.string() }),
    effect: setValue("data.domain.name", ["get", "$input.name"], "Set domain name"),
    semantic: actionSemantic("update", "Update domain name"),
  }),

  // Domain description - simple string value
  setDomainDescription: defineAction({
    deps: ["data.domain.description"],
    input: z.object({ description: z.string() }),
    effect: setValue(
      "data.domain.description",
      ["get", "$input.description"],
      "Set domain description"
    ),
    semantic: actionSemantic("update", "Update domain description"),
  }),

  // UI state - select block (string or null)
  selectBlock: defineAction({
    deps: ["state.selectedBlockId"],
    input: z.object({ id: z.string().nullable() }),
    effect: setState(
      "state.selectedBlockId",
      ["get", "$input.id"],
      "Select block"
    ),
    semantic: actionSemantic("select", "Select a block in the editor"),
  }),

  // UI state - validating flag
  setValidating: defineAction({
    deps: ["state.isValidating"],
    input: z.object({ isValidating: z.boolean() }),
    effect: setState(
      "state.isValidating",
      ["get", "$input.isValidating"],
      "Set validating state"
    ),
    semantic: actionSemantic("update", "Set validation status"),
  }),
};
