import type {
  DomainSchema,
  Intent,
  Patch,
  Snapshot as CoreSnapshot,
} from "@manifesto-ai/core";

type ActionFn = {
  bivarianceHack(...args: unknown[]): unknown;
}["bivarianceHack"];

export type ManifestoDomainShape = {
  readonly actions: Record<string, ActionFn>;
  readonly state: Record<string, unknown>;
  readonly computed: Record<string, unknown>;
};

export type BaseLaws = { readonly __baseLaws: true };
export type LineageLaws = { readonly __lineageLaws: true };
export type GovernanceLaws = { readonly __governanceLaws: true };
export type BaseComposableLaws = BaseLaws & {
  readonly __lineageLaws?: never;
  readonly __governanceLaws?: never;
};
export type LineageComposableLaws = BaseLaws & LineageLaws & {
  readonly __governanceLaws?: never;
};
export type GovernedComposableLaws = BaseLaws & LineageLaws & GovernanceLaws;

export type Snapshot<T = unknown> = Omit<CoreSnapshot, "data"> & { data: T };

export type EffectContext<T = unknown> = {
  readonly snapshot: Readonly<Snapshot<T>>;
};

export type EffectHandler = (
  params: unknown,
  ctx: EffectContext,
) => Promise<readonly Patch[]>;

export type TypedActionRef<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"] = keyof T["actions"],
> = {
  readonly __kind: "ActionRef";
  readonly name: K;
};

export type FieldRef<TValue> = {
  readonly __kind: "FieldRef";
  readonly _type?: TValue;
};

export type ComputedRef<TValue> = {
  readonly __kind: "ComputedRef";
  readonly _type?: TValue;
};

export type TypedMEL<T extends ManifestoDomainShape> = {
  readonly actions: {
    readonly [K in keyof T["actions"]]: TypedActionRef<T, K>;
  };
  readonly state: {
    readonly [K in keyof T["state"]]: FieldRef<T["state"][K]>;
  };
  readonly computed: {
    readonly [K in keyof T["computed"]]: ComputedRef<T["computed"][K]>;
  };
};

export type ActionArgs<
  T extends ManifestoDomainShape,
  K extends keyof T["actions"],
> = T["actions"][K] extends (...args: infer P) => unknown ? P : never;

export type Selector<T, R> = (snapshot: Snapshot<T>) => R;
export type Unsubscribe = () => void;

export type TypedCreateIntent<T extends ManifestoDomainShape> = <
  K extends keyof T["actions"],
>(
  action: TypedActionRef<T, K>,
  ...args: ActionArgs<T, K>
) => Intent;

export type TypedDispatchAsync<T extends ManifestoDomainShape> = (
  intent: Intent,
) => Promise<Snapshot<T["state"]>>;
export type TypedCommitAsync<T extends ManifestoDomainShape> =
  TypedDispatchAsync<T>;

export type TypedSubscribe<T extends ManifestoDomainShape> = <R>(
  selector: Selector<T["state"], R>,
  listener: (value: R) => void,
) => Unsubscribe;

export interface ManifestoEventMap<T extends ManifestoDomainShape> {
  "dispatch:completed": {
    readonly intentId: string;
    readonly intent: Intent;
    readonly snapshot: Snapshot<T["state"]>;
  };
  "dispatch:rejected": {
    readonly intentId: string;
    readonly intent: Intent;
    readonly reason: string;
  };
  "dispatch:failed": {
    readonly intentId: string;
    readonly intent: Intent;
    readonly error: Error;
    readonly snapshot?: Snapshot<T["state"]>;
  };
}

export type ManifestoEvent =
  | "dispatch:completed"
  | "dispatch:rejected"
  | "dispatch:failed";

export type ManifestoEventPayload<T extends ManifestoDomainShape> =
  ManifestoEventMap<T>[ManifestoEvent];

export type TypedOn<T extends ManifestoDomainShape> = <
  K extends ManifestoEvent,
>(
  event: K,
  handler: (payload: ManifestoEventMap<T>[K]) => void,
) => Unsubscribe;

export type ManifestoBaseInstance<T extends ManifestoDomainShape> = {
  readonly createIntent: TypedCreateIntent<T>;
  readonly dispatchAsync: TypedDispatchAsync<T>;
  readonly subscribe: TypedSubscribe<T>;
  readonly on: TypedOn<T>;
  readonly getSnapshot: () => Snapshot<T["state"]>;
  readonly getAvailableActions: () => readonly (keyof T["actions"])[];
  readonly isActionAvailable: (name: keyof T["actions"]) => boolean;
  readonly MEL: TypedMEL<T>;
  readonly schema: DomainSchema;
  readonly dispose: () => void;
};

export interface ManifestoRuntimeByLaws<T extends ManifestoDomainShape> {
  readonly base: ManifestoBaseInstance<T>;
}

export interface ManifestoDecoratedRuntimeByLaws<
  T extends ManifestoDomainShape,
> {}

type ResolvedManifestoRuntimeByLaws<
  T extends ManifestoDomainShape,
> = ManifestoRuntimeByLaws<T> & ManifestoDecoratedRuntimeByLaws<T>;

export type ActivatedInstance<
  T extends ManifestoDomainShape,
  Laws,
> =
  Laws extends GovernanceLaws
    ? ResolvedManifestoRuntimeByLaws<T> extends { readonly governance: infer Runtime }
      ? Runtime
      : never
    : Laws extends LineageLaws
      ? ResolvedManifestoRuntimeByLaws<T> extends { readonly lineage: infer Runtime }
        ? Runtime
        : never
      : ManifestoRuntimeByLaws<T>["base"];

export type ComposableManifesto<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws = BaseComposableLaws,
> = {
  readonly _laws: Laws;
  readonly schema: DomainSchema;
  activate(): ActivatedInstance<T, Laws>;
};
