import type {
  CreateIntentArgs,
  TypedActionRef,
  TypedIntent,
  CanonicalSnapshot,
  ComposableManifesto,
  GovernedComposableLaws,
  ManifestoDomainShape,
  Snapshot,
} from "@manifesto-ai/sdk";
import type { SimulateResult as KernelSimulateResult } from "@manifesto-ai/sdk/provider";
import type { GovernanceInstance } from "@manifesto-ai/governance";

export interface PlannerBuilder0<T extends ManifestoDomainShape> {
  features<F extends Record<string, (snapshot: Snapshot<T["state"]>) => number>>(
    features: F,
  ): PlannerBuilder1<T, keyof F & string>;
}

export interface PlannerBuilder1<T extends ManifestoDomainShape, FK extends string> {
  trajectoryFeatures<TF extends Record<string, (trajectory: readonly SimulationStep<T>[]) => number>>(
    features: TF,
  ): PlannerBuilder2<T, FK, keyof TF & string>;

  parameters<P extends Record<string, number>>(
    params: P,
  ): PlannerBuilder3<T, FK, never, keyof P & string>;

  terms<TM extends Record<string, (
    features: Record<FK, number>,
    parameters: {},
  ) => number>>(
    terms: TM,
  ): PlannerBuilder4<T, never, keyof TM & string>;
}

export interface PlannerBuilder2<
  T extends ManifestoDomainShape,
  FK extends string,
  TFK extends string,
> {
  parameters<P extends Record<string, number>>(
    params: P,
  ): PlannerBuilder3<T, FK, TFK, keyof P & string>;

  terms<TM extends Record<string, (
    features: Record<FK | TFK, number>,
    parameters: {},
  ) => number>>(
    terms: TM,
  ): PlannerBuilder4<T, never, keyof TM & string>;
}

export interface PlannerBuilder3<
  T extends ManifestoDomainShape,
  FK extends string,
  TFK extends string,
  PK extends string,
> {
  terms<TM extends Record<string, (
    features: Record<FK | TFK, number>,
    parameters: Record<PK, number>,
  ) => number>>(
    terms: TM,
  ): PlannerBuilder4<T, PK, keyof TM & string>;
}

export interface PlannerBuilder4<
  T extends ManifestoDomainShape,
  PK extends string = never,
  TermK extends string = string,
> {
  build(): Planner<T, PK, TermK>;
}

export interface EvaluationResult<TermK extends string = string> {
  readonly terms: Readonly<Record<TermK, number>>;
}

export interface ActionCandidate<T extends ManifestoDomainShape = ManifestoDomainShape> {
  readonly actionName: keyof T["actions"] & string;
  readonly input?: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AvailableAction<T extends ManifestoDomainShape = ManifestoDomainShape>
  extends ActionCandidate<T> {
  readonly candidateId: string;
}

export interface SimulationStep<T extends ManifestoDomainShape = ManifestoDomainShape> {
  readonly action: ActionCandidate<T>;
  readonly snapshotBefore: Snapshot<T["state"]>;
  readonly snapshotAfter: Snapshot<T["state"]>;
  readonly patches: KernelSimulateResult<T>["patches"];
  readonly depth: number;
}

export interface CanonicalSimulationStep<T extends ManifestoDomainShape = ManifestoDomainShape> {
  readonly action: AvailableAction<T>;
  readonly snapshotBefore: CanonicalSnapshot<T["state"]>;
  readonly snapshotAfter: CanonicalSnapshot<T["state"]>;
  readonly patches: KernelSimulateResult<T>["patches"];
  readonly depth: number;
}

export interface Planner<
  T extends ManifestoDomainShape,
  PK extends string = string,
  TermK extends string = string,
> {
  readonly definedTerms: readonly TermK[];
  setParameter(key: PK, value: number): void;
  getParameters(): Readonly<Record<PK, number>>;
  evaluate(
    trajectory: readonly CanonicalSimulationStep<T>[],
    finalSnapshot: CanonicalSnapshot<T["state"]>,
  ): EvaluationResult<TermK>;
}

export interface PlannerComposable<
  T extends ManifestoDomainShape,
  TermK extends string = string,
> {
  activate(): GovernanceInstance<T> & PlannerRuntime<T, TermK>;
}

export interface HardPolicy {
  readonly maxDepth?: number;
  readonly maxExpansions?: number;
  readonly timeoutMs?: number;
}

export interface WithPlannerConfig<
  T extends ManifestoDomainShape,
  PK extends string = string,
  TermK extends string = string,
> {
  readonly planner: Planner<T, PK, TermK>;
  readonly strategy: Strategy<T, TermK>;
  readonly enumerator?: ActionEnumerator<T>;
  readonly hardPolicy?: HardPolicy;
}

export interface ActionPreview<
  T extends ManifestoDomainShape,
  TermK extends string = string,
> {
  readonly snapshotAfter: Snapshot<T["state"]>;
  readonly patches: KernelSimulateResult<T>["patches"];
  readonly status: KernelSimulateResult<T>["status"];
  readonly pendingRequirements: KernelSimulateResult<T>["requirements"];
  readonly evaluation: EvaluationResult<TermK>;
  readonly intent: TypedIntent<T>;
}

export interface PlanOptions {
  readonly budgetOverride?: number;
  readonly depthOverride?: number;
  readonly signal?: AbortSignal;
}

export interface PlanStats {
  readonly expansions: number;
  readonly maxDepthReached: number;
  readonly elapsedMs: number;
  readonly pruned: number;
  readonly terminationReason:
    | "completed"
    | "budget_exhausted"
    | "timeout"
    | "goal_reached"
    | "signal_aborted"
    | "no_actions";
}

export interface SelectedAction<
  T extends ManifestoDomainShape,
  TermK extends string = string,
> {
  readonly actionName: keyof T["actions"] & string;
  readonly input?: unknown;
  readonly intent: TypedIntent<T>;
  readonly evaluation: EvaluationResult<TermK>;
  readonly trajectory: readonly SimulationStep<T>[];
  readonly confidence: number;
}

export interface Plan<
  T extends ManifestoDomainShape,
  TermK extends string = string,
> {
  readonly bestAction: SelectedAction<T, TermK> | null;
  readonly alternatives: readonly SelectedAction<T, TermK>[];
  readonly stats: PlanStats;
}

export interface PlannerRuntime<
  T extends ManifestoDomainShape,
  TermK extends string = string,
> {
  preview<K extends keyof T["actions"] & string>(
    actionRef: TypedActionRef<T, K>,
    ...args: CreateIntentArgs<T, K>
  ): ActionPreview<T, TermK>;
  plan(options?: PlanOptions): Promise<Plan<T, TermK>>;
}

export interface PlannerEvaluator<
  T extends ManifestoDomainShape = ManifestoDomainShape,
  TermK extends string = string,
> {
  evaluate(
    trajectory: readonly CanonicalSimulationStep<T>[],
    finalSnapshot: CanonicalSnapshot<T["state"]>,
  ): EvaluationResult<TermK>;
}

export interface SimulationResult<T extends ManifestoDomainShape = ManifestoDomainShape> {
  readonly snapshot: CanonicalSnapshot<T["state"]>;
  readonly status: KernelSimulateResult<T>["status"];
  readonly patches: KernelSimulateResult<T>["patches"];
  readonly pendingRequirements: KernelSimulateResult<T>["requirements"];
}

export interface Simulator<T extends ManifestoDomainShape = ManifestoDomainShape> {
  step(
    snapshot: CanonicalSnapshot<T["state"]>,
    action: AvailableAction<T>,
  ): SimulationResult<T>;
}

export interface StrategyEnumerator<T extends ManifestoDomainShape = ManifestoDomainShape> {
  enumerate(snapshot: CanonicalSnapshot<T["state"]>): readonly AvailableAction<T>[];
}

export interface StrategyContext<
  T extends ManifestoDomainShape = ManifestoDomainShape,
  TermK extends string = string,
> {
  readonly simulator: Simulator<T>;
  readonly enumerator: StrategyEnumerator<T>;
  readonly evaluator: PlannerEvaluator<T, TermK>;
  readonly currentSnapshot: CanonicalSnapshot<T["state"]>;
  readonly hardPolicy: Readonly<Required<HardPolicy>>;
  readonly options: Readonly<PlanOptions>;
}

export interface RawPlan<
  T extends ManifestoDomainShape = ManifestoDomainShape,
  TermK extends string = string,
> {
  readonly bestAction: {
    readonly actionName: keyof T["actions"] & string;
    readonly input?: unknown;
    readonly candidateId: string;
    readonly evaluation: EvaluationResult<TermK>;
    readonly trajectory: readonly CanonicalSimulationStep<T>[];
    readonly confidence: number;
  } | null;
  readonly alternatives: readonly NonNullable<RawPlan<T, TermK>["bestAction"]>[];
  readonly stats: PlanStats;
}

export interface Strategy<
  T extends ManifestoDomainShape = ManifestoDomainShape,
  TermK extends string = string,
> {
  readonly name: string;
  readonly requiredTerms: readonly TermK[];
  run(context: StrategyContext<T, TermK>): Promise<RawPlan<T, TermK>>;
}

export interface ActionEnumerator<T extends ManifestoDomainShape = ManifestoDomainShape> {
  enumerate(snapshot: CanonicalSnapshot<T["state"]>): readonly ActionCandidate<T>[];
}

export interface GreedyStrategyConfig<TermK extends string = string> {
  readonly useTerm: TermK;
}

export interface MctsStrategyConfig<TermK extends string = string> {
  readonly useTerm: TermK;
  readonly budget?: number;
  readonly exploration?: number;
}

export type PlannerGovernedComposable<
  T extends ManifestoDomainShape,
> = ComposableManifesto<T, GovernedComposableLaws>;
