import { z } from "zod";

export type JsonValue =
  | null
  | string
  | number
  | boolean
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export const JsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.array(JsonValue),
    z.record(z.string(), JsonValue),
  ]),
);

export type Context<
  TExternalContext extends Record<string, JsonValue> = Record<string, JsonValue>,
> = {
  readonly runtime: {
    readonly time: {
      readonly timestamp: number;
    };
    readonly random: {
      readonly seed: string;
    };
  };
  readonly external: TExternalContext;
};

export const Context: z.ZodType<Context> = z.object({
  runtime: z.object({
    time: z.object({
      timestamp: z.number().finite(),
    }),
    random: z.object({
      seed: z.string(),
    }),
  }),
  external: z.record(z.string(), JsonValue),
});
