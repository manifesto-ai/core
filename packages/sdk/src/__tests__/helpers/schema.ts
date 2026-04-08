import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";

const pp = semanticPathToPatchPath;

export type CounterDomain = {
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

export type MelCounterDomain = {
  actions: {
    increment: () => void;
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

export function createRawCounterSchema(): Omit<DomainSchema, "hash"> {
  return {
    id: "manifesto:sdk-v3-counter",
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
  };
}

export function createCounterSchema(): DomainSchema {
  return withHash(createRawCounterSchema());
}

export type DispatchabilityDomain = {
  actions: {
    increment: () => void;
    incrementGuarded: (max: number) => void;
    disable: () => void;
  };
  state: {
    count: number;
    enabled: boolean;
  };
  computed: {};
};

export function createDispatchabilitySchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-v3-dispatchability",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
        enabled: { type: "boolean", required: false, default: true },
      },
    },
    computed: { fields: {} },
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
      incrementGuarded: {
        description: "Increment only while enabled and below the caller-provided max",
        input: {
          type: "object",
          required: true,
          fields: {
            max: { type: "number", required: true },
          },
        },
        available: {
          kind: "get",
          path: "enabled",
        },
        dispatchable: {
          kind: "lt",
          left: { kind: "get", path: "count" },
          right: { kind: "get", path: "input.max" },
        },
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
      disable: {
        flow: {
          kind: "patch",
          op: "set",
          path: pp("enabled"),
          value: { kind: "lit", value: false },
        },
      },
    },
  });
}

export const counterMelSource = `
domain Counter {
  state { count: number = 0 }

  action increment() {
    when true { patch count = add(count, 1) }
  }
}
`;
