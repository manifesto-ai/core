import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";
import type { ManifestoDomainShape } from "@manifesto-ai/sdk";
import type {
  ActorAuthorityBinding,
  GovernanceExecutionConfig,
} from "@manifesto-ai/governance";

const pp = semanticPathToPatchPath;

export type CounterDomain = ManifestoDomainShape & {
  actions: {
    increment: () => void;
    add: (amount: number) => void;
    incrementIfEven: () => void;
    load: () => void;
  };
  state: {
    count: number;
    status: string;
  };
  computed: {
    doubled: number;
  };
};

export type HaltingDomain = ManifestoDomainShape & {
  actions: {
    finalize: () => void;
  };
  state: {
    status: string;
  };
  computed: {};
};

export type FailingDomain = ManifestoDomainShape & {
  actions: {
    fail: () => void;
  };
  state: {
    status: string;
  };
  computed: {};
};

export type CollisionDomain = ManifestoDomainShape & {
  actions: {
    then: () => void;
    bind: () => void;
    constructor: () => void;
    inspect: () => void;
    snapshot: () => void;
    dispose: () => void;
    action: () => void;
  };
  state: {
    count: number;
  };
  computed: {};
};

export function withHash(schema: Omit<DomainSchema, "hash">): DomainSchema {
  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

export function createCounterSchema(): DomainSchema {
  return withHash({
    id: "manifesto:activation-cts-counter",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
        status: { type: "string", required: false, default: "idle" },
      },
    },
    computed: {
      fields: {
        doubled: {
          deps: ["count"],
          expr: {
            kind: "mul",
            left: { kind: "get", path: "count" },
            right: { kind: "lit", value: 2 },
          },
        },
      },
    },
    actions: {
      increment: {
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: {
            kind: "add",
            left: { kind: "get", path: "count" },
            right: { kind: "lit", value: 1 },
          },
        },
      },
      add: {
        input: {
          type: "object",
          required: true,
          fields: {
            amount: { type: "number", required: true },
          },
        },
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: {
            kind: "add",
            left: { kind: "get", path: "count" },
            right: { kind: "get", path: "input.amount" },
          },
        },
      },
      incrementIfEven: {
        available: {
          kind: "eq",
          left: {
            kind: "mod",
            left: { kind: "get", path: "count" },
            right: { kind: "lit", value: 2 },
          },
          right: { kind: "lit", value: 0 },
        },
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: {
            kind: "add",
            left: { kind: "get", path: "count" },
            right: { kind: "lit", value: 10 },
          },
        },
      },
      load: {
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "patch",
              op: "set",
              path: pp("status"),
              value: { kind: "lit", value: "loading" },
            },
            {
              kind: "effect",
              type: "api.fetch",
              params: {},
            },
          ],
        },
      },
    },
  });
}

export function createHaltingSchema(): DomainSchema {
  return withHash({
    id: "manifesto:activation-cts-halting",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        status: { type: "string", required: false, default: "idle" },
      },
    },
    computed: {
      fields: {},
    },
    actions: {
      finalize: {
        flow: {
          kind: "halt",
          reason: "done",
        },
      },
    },
  });
}

export function createFailingSchema(): DomainSchema {
  return withHash({
    id: "manifesto:activation-cts-failing",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        status: { type: "string", required: false, default: "idle" },
      },
    },
    computed: {
      fields: {},
    },
    actions: {
      fail: {
        flow: {
          kind: "fail",
          code: "DOMAIN_FAIL",
          message: { kind: "lit", value: "repair required" },
        },
      },
    },
  });
}

export function createCollisionSchema(): DomainSchema {
  const actionValues = {
    then: 1,
    bind: 2,
    constructor: 3,
    inspect: 4,
    snapshot: 5,
    dispose: 6,
    action: 7,
  } as const;

  return withHash({
    id: "manifesto:activation-cts-collisions",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
      },
    },
    computed: { fields: {} },
    actions: Object.fromEntries(
      Object.entries(actionValues).map(([name, value]) => [
        name,
        {
          flow: {
            kind: "patch",
            op: "set",
            path: pp("count"),
            value: { kind: "lit", value },
          },
        },
      ]),
    ),
  });
}

export function createAutoBinding(): ActorAuthorityBinding {
  return {
    actorId: "actor:auto",
    authorityId: "authority:auto",
    policy: {
      mode: "auto_approve",
    },
  };
}

export function createExecutionConfig(
  projectionId: string,
): GovernanceExecutionConfig<CounterDomain> {
  return {
    projectionId,
    deriveActor: () => ({
      actorId: "actor:auto",
      kind: "agent",
    }),
    deriveSource: () => ({
      kind: "agent",
      eventId: `evt:${projectionId}`,
    }),
  };
}
