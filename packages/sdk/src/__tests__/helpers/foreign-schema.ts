import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";

const pp = semanticPathToPatchPath;

export type ForeignDomain = {
  actions: {
    toggle: () => void;
  };
  state: {
    enabled: boolean;
  };
  computed: {};
};

export function createForeignSchema(): DomainSchema {
  const schema: Omit<DomainSchema, "hash"> = {
    id: "manifesto:sdk-v3-foreign",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        enabled: { type: "boolean", required: false, default: false },
      },
    },
    computed: {
      fields: {},
    },
    actions: {
      toggle: {
        flow: {
          kind: "patch",
          op: "set",
          path: pp("enabled"),
          value: {
            kind: "not",
            arg: { kind: "get", path: "enabled" },
          },
        },
      },
    },
  };

  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}
