import { createManifesto } from "@manifesto-ai/sdk";
import type { ManifestoDomainShape } from "@manifesto-ai/sdk";
import {
  createInMemoryLineageStore,
  withLineage,
} from "@manifesto-ai/lineage";
import {
  withGovernance,
  type ActorAuthorityBinding,
  type GovernanceComposableManifesto,
} from "@manifesto-ai/governance";
import type { DomainSchema } from "@manifesto-ai/core";

export function createAutoBinding(actorId = "actor:auto"): ActorAuthorityBinding {
  return {
    actorId,
    authorityId: "authority:auto",
    policy: { mode: "auto_approve" },
  };
}

export function createGovernedManifesto<T extends ManifestoDomainShape>(
  schema: DomainSchema,
  effects: Record<string, unknown> = {},
  actorId = "actor:auto",
): GovernanceComposableManifesto<T> {
  return withGovernance(
    withLineage(
      createManifesto<T>(schema, effects),
      { store: createInMemoryLineageStore() },
    ),
    {
      bindings: [createAutoBinding(actorId)],
      execution: {
        projectionId: "planner:test",
        deriveActor: () => ({
          actorId,
          kind: "agent",
        }),
        deriveSource: () => ({
          kind: "agent",
          eventId: "evt:planner:test",
        }),
      },
    },
  );
}
