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

export const counterMelSource = `
domain Counter {
  state { count: number = 0 }

  action increment() {
    when true { patch count = add(count, 1) }
  }
}
`;
