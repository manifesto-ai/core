import { ManifestoError } from "@manifesto-ai/sdk";
import type {
  CanonicalSnapshot,
  ManifestoDomainShape,
  Snapshot,
} from "@manifesto-ai/sdk";

import {
  attachPlannerInternals,
  defaultProjectCanonicalSnapshot,
  freezeValue,
  toProjectedStep,
  type PlannerInternals,
} from "./internal.js";
import type {
  CanonicalSimulationStep,
  EvaluationResult,
  Planner,
  PlannerBuilder0,
  PlannerBuilder1,
  PlannerBuilder2,
  PlannerBuilder3,
  PlannerBuilder4,
  SimulationStep,
} from "./runtime-types.js";

type SnapshotFeatureMap<T extends ManifestoDomainShape> = Record<
  string,
  (snapshot: Snapshot<T["state"]>) => number
>;

type TrajectoryFeatureMap<T extends ManifestoDomainShape> = Record<
  string,
  (trajectory: readonly SimulationStep<T>[]) => number
>;

type ParameterMap = Record<string, number>;
type TermMap = Record<string, (features: Record<string, number>, parameters: Record<string, number>) => number>;

type BuilderState<T extends ManifestoDomainShape> = {
  readonly snapshotFeatures: SnapshotFeatureMap<T>;
  readonly trajectoryFeatures: TrajectoryFeatureMap<T>;
  readonly parameters: ParameterMap;
};

export function createPlanner<T extends ManifestoDomainShape>(): PlannerBuilder0<T> {
  return freezeValue({
    features<F extends SnapshotFeatureMap<T>>(features: F) {
      assertNonEmpty("features", features);
      const nextState: BuilderState<T> = freezeValue({
        snapshotFeatures: { ...features },
        trajectoryFeatures: {},
        parameters: {},
      });
      return createBuilderStage1<T, keyof F & string>(nextState);
    },
  }) as PlannerBuilder0<T>;
}

function createBuilderStage1<
  T extends ManifestoDomainShape,
  FK extends string,
>(
  state: BuilderState<T>,
): PlannerBuilder1<T, FK> {
  return freezeValue({
    trajectoryFeatures<TF extends TrajectoryFeatureMap<T>>(features: TF) {
      const nextState: BuilderState<T> = freezeValue({
        ...state,
        trajectoryFeatures: { ...features },
      });
      return createBuilderStage2<T, FK, keyof TF & string>(nextState);
    },
    parameters<P extends ParameterMap>(params: P) {
      const nextState: BuilderState<T> = freezeValue({
        ...state,
        parameters: { ...params },
      });
      return createBuilderStage3<T, FK, never, keyof P & string>(nextState);
    },
    terms<TM extends Record<string, (
      features: Record<FK, number>,
      parameters: {},
    ) => number>>(terms: TM) {
      return createBuilderStage4<T, never, keyof TM & string>(
        buildPlanner<T, never, keyof TM & string>(state, terms as TermMap),
      );
    },
  }) as PlannerBuilder1<T, FK>;
}

function createBuilderStage2<
  T extends ManifestoDomainShape,
  FK extends string,
  TFK extends string,
>(
  state: BuilderState<T>,
): PlannerBuilder2<T, FK, TFK> {
  return freezeValue({
    parameters<P extends ParameterMap>(params: P) {
      const nextState: BuilderState<T> = freezeValue({
        ...state,
        parameters: { ...params },
      });
      return createBuilderStage3<T, FK, TFK, keyof P & string>(nextState);
    },
    terms<TM extends Record<string, (
      features: Record<FK | TFK, number>,
      parameters: {},
    ) => number>>(terms: TM) {
      return createBuilderStage4<T, never, keyof TM & string>(
        buildPlanner<T, never, keyof TM & string>(state, terms as TermMap),
      );
    },
  }) as PlannerBuilder2<T, FK, TFK>;
}

function createBuilderStage3<
  T extends ManifestoDomainShape,
  FK extends string,
  TFK extends string,
  PK extends string,
>(
  state: BuilderState<T>,
): PlannerBuilder3<T, FK, TFK, PK> {
  return freezeValue({
    terms<TM extends Record<string, (
      features: Record<FK | TFK, number>,
      parameters: Record<PK, number>,
    ) => number>>(terms: TM) {
      return createBuilderStage4<T, PK, keyof TM & string>(
        buildPlanner<T, PK, keyof TM & string>(state, terms as TermMap),
      );
    },
  }) as PlannerBuilder3<T, FK, TFK, PK>;
}

function createBuilderStage4<
  T extends ManifestoDomainShape,
  PK extends string,
  TermK extends string,
>(
  planner: Planner<T, PK, TermK>,
): PlannerBuilder4<T, PK, TermK> {
  return freezeValue({
    build() {
      return planner;
    },
  }) as PlannerBuilder4<T, PK, TermK>;
}

function buildPlanner<
  T extends ManifestoDomainShape,
  PK extends string,
  TermK extends string,
>(
  state: BuilderState<T>,
  rawTerms: TermMap,
): Planner<T, PK, TermK> {
  assertNonEmpty("terms", rawTerms);
  assertFiniteNumberMap("parameters", state.parameters);

  const termNames = Object.freeze(Object.keys(rawTerms)) as readonly TermK[];
  const termFns = freezeValue({ ...rawTerms }) as Readonly<Record<TermK, TermMap[string]>>;
  const snapshotFeatures = freezeValue({ ...state.snapshotFeatures });
  const trajectoryFeatures = freezeValue({ ...state.trajectoryFeatures });
  const mutableParameters: Record<string, number> = { ...state.parameters };

  const getParametersSnapshot = (): Readonly<Record<PK, number>> => {
    return freezeValue({ ...mutableParameters }) as Readonly<Record<PK, number>>;
  };

  const evaluateCanonical: PlannerInternals<T, PK, TermK>["evaluateCanonical"] = (
    trajectory,
    finalSnapshot,
    projectSnapshot,
    parameterSnapshot,
  ) => {
    const projectedFinalSnapshot = projectSnapshot(finalSnapshot);
    const projectedTrajectory = Object.freeze(
      trajectory.map((step) => toProjectedStep(step, projectSnapshot)),
    ) as readonly SimulationStep<T>[];

    const features: Record<string, number> = {};
    for (const [name, feature] of Object.entries(snapshotFeatures)) {
      features[name] = feature(projectedFinalSnapshot);
    }
    for (const [name, feature] of Object.entries(trajectoryFeatures)) {
      features[name] = feature(projectedTrajectory);
    }

    const terms = {} as Record<TermK, number>;
    for (const termName of termNames) {
      const termFn = termFns[termName];
      terms[termName] = termFn(
        features,
        parameterSnapshot as Record<string, number>,
      );
    }

    return freezeValue({
      terms: freezeValue(terms),
    }) as EvaluationResult<TermK>;
  };

  const planner = {
    definedTerms: termNames,
    setParameter(key: PK, value: number) {
      assertFiniteNumber(`parameter "${String(key)}"`, value);
      mutableParameters[key] = value;
    },
    getParameters() {
      return getParametersSnapshot();
    },
    evaluate(
      trajectory: readonly CanonicalSimulationStep<T>[],
      finalSnapshot: CanonicalSnapshot<T["state"]>,
    ): EvaluationResult<TermK> {
      return evaluateCanonical(
        trajectory,
        finalSnapshot,
        defaultProjectCanonicalSnapshot,
        getParametersSnapshot(),
      );
    },
  } as Planner<T, PK, TermK>;

  attachPlannerInternals(planner, {
    getParametersSnapshot,
    evaluateCanonical,
  });

  return freezeValue(planner);
}

function assertNonEmpty(name: string, value: Record<string, unknown>): void {
  if (Object.keys(value).length > 0) {
    return;
  }

  throw new ManifestoError(
    "PLANNER_CONFIG_REQUIRED",
    `createPlanner().${name}() requires at least one entry`,
  );
}

function assertFiniteNumberMap(name: string, values: Record<string, number>): void {
  for (const [key, value] of Object.entries(values)) {
    assertFiniteNumber(`${name}.${key}`, value);
  }
}

function assertFiniteNumber(label: string, value: number): void {
  if (Number.isFinite(value)) {
    return;
  }

  throw new ManifestoError(
    "PLANNER_INVALID_NUMBER",
    `Planner ${label} must be a finite number`,
  );
}
