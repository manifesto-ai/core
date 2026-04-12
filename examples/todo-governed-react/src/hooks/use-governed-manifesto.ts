import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  createInMemoryGovernanceStore,
  waitForProposal,
  withGovernance,
  type GovernanceInstance,
  type Proposal,
} from "@manifesto-ai/governance";
import {
  createInMemoryLineageStore,
  withLineage,
} from "@manifesto-ai/lineage";
import {
  type TypedIntent,
  createManifesto,
  type Snapshot,
} from "@manifesto-ai/sdk";

import todoSchema from "../domain/todo.mel";
import type {
  ActivityEntry,
  FilterMode,
  ReviewItem,
  TodoData,
  TodoDomain,
  TodoSettlement,
} from "../types";

type TodoSnapshot = Snapshot<TodoData>;

type UseGovernedManifestoResult = {
  readonly state: TodoSnapshot | null;
  readonly ready: boolean;
  readonly error: string | null;
  readonly availableActions: readonly string[];
  readonly reviewQueue: readonly ReviewItem[];
  readonly activity: readonly ActivityEntry[];
  readonly addTodo: (title: string) => Promise<void>;
  readonly toggleTodo: (id: string) => Promise<void>;
  readonly removeTodo: (id: string) => Promise<void>;
  readonly setFilter: (newFilter: FilterMode) => Promise<void>;
  readonly clearCompleted: () => Promise<void>;
  readonly approveProposal: (proposalId: string) => Promise<void>;
  readonly rejectProposal: (proposalId: string) => Promise<void>;
};

const AUTO_ACTOR_ID = "actor:writer:auto";
const REVIEWABLE_ACTOR_ID = "actor:writer:reviewable";
const REVIEWER_ID = "actor:reviewer";
const REVIEWABLE_ACTIONS = new Set<string>(["removeTodo", "clearCompleted"]);

function createGovernedRuntime(): GovernanceInstance<TodoDomain> {
  return withGovernance(
    withLineage(
      createManifesto<TodoDomain>(todoSchema as string, {}),
      { store: createInMemoryLineageStore() },
    ),
    {
      governanceStore: createInMemoryGovernanceStore(),
      bindings: [
        {
          actorId: AUTO_ACTOR_ID,
          authorityId: "authority:auto",
          policy: { mode: "auto_approve" },
        },
        {
          actorId: REVIEWABLE_ACTOR_ID,
          authorityId: "authority:human-review",
          policy: {
            mode: "hitl",
            delegate: {
              actorId: REVIEWER_ID,
              kind: "human",
              name: "Manual Reviewer",
            },
          },
        },
      ],
      execution: {
        projectionId: "todo-governed-react",
        deriveActor: (intent) => ({
          actorId: REVIEWABLE_ACTIONS.has(intent.type)
            ? REVIEWABLE_ACTOR_ID
            : AUTO_ACTOR_ID,
          kind: "human",
          name: REVIEWABLE_ACTIONS.has(intent.type)
            ? "Reviewable Writer"
            : "Auto Writer",
        }),
        deriveSource: (intent) => ({
          kind: "ui",
          eventId: intent.intentId ?? crypto.randomUUID(),
        }),
      },
    },
  ).activate();
}

function sortBySubmittedAt(proposals: readonly Proposal[]): readonly Proposal[] {
  return [...proposals].sort((left, right) => right.submittedAt - left.submittedAt);
}

function formatTodoLabel(
  type: string,
  input: unknown,
  snapshot: TodoSnapshot | null,
): string {
  if (type === "addTodo" && typeof input === "string") {
    return `Add "${input}"`;
  }

  if (type === "toggleTodo" && typeof input === "string") {
    const title = snapshot?.data.todos.find((todo) => todo.id === input)?.title;
    return title ? `Toggle "${title}"` : "Toggle todo";
  }

  if (type === "removeTodo" && typeof input === "string") {
    const title = snapshot?.data.todos.find((todo) => todo.id === input)?.title;
    return title ? `Delete "${title}"` : "Delete todo";
  }

  if (type === "setFilter" && typeof input === "string") {
    return `Show ${input}`;
  }

  if (type === "clearCompleted") {
    return "Clear completed";
  }

  return type;
}

function formatQueueDetail(proposal: Proposal): string {
  switch (proposal.intent.type) {
    case "removeTodo":
      return "Deletion stays in evaluating until a reviewer approves or rejects it.";
    case "clearCompleted":
      return "Bulk cleanup is gated so a reviewer can inspect the pending removal.";
    default:
      return "Proposal is waiting on governance review.";
  }
}

function formatSettlementDetail(
  settlement: TodoSettlement,
  proposal: Proposal,
): string {
  switch (settlement.kind) {
    case "completed":
      return "Proposal was approved and sealed into the current visible snapshot.";
    case "failed":
      return settlement.error.summary;
    case "rejected":
      return "Reviewer rejected the proposal before it changed state.";
    case "superseded":
      return "Proposal became stale after the branch head changed.";
    case "pending":
      return `Proposal is still ${proposal.status} and waiting for governance.`;
    case "timed_out":
      return "Observation timed out. The proposal may still settle later.";
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unexpected Manifesto runtime error";
}

export function useGovernedManifesto(): UseGovernedManifestoResult {
  const runtimeRef = useRef<GovernanceInstance<TodoDomain> | null>(null);
  const snapshotRef = useRef<TodoSnapshot | null>(null);
  const activityRef = useRef<readonly ActivityEntry[]>([]);

  const [state, setState] = useState<TodoSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableActions, setAvailableActions] = useState<readonly string[]>([]);
  const [reviewQueue, setReviewQueue] = useState<readonly ReviewItem[]>([]);
  const [activity, setActivity] = useState<readonly ActivityEntry[]>([]);

  const syncSnapshot = useEffectEvent((nextSnapshot: TodoSnapshot) => {
    snapshotRef.current = nextSnapshot;
    const runtime = runtimeRef.current;
    startTransition(() => {
      setState(nextSnapshot);
      setAvailableActions(runtime?.getAvailableActions() ?? []);
    });
  });

  const syncActivity = useEffectEvent((nextActivity: readonly ActivityEntry[]) => {
    activityRef.current = nextActivity;
    startTransition(() => setActivity(nextActivity));
  });

  const refreshQueue = useEffectEvent(async (runtime: GovernanceInstance<TodoDomain>) => {
    const snapshot = snapshotRef.current;
    const nextQueue = sortBySubmittedAt(
      (await runtime.getProposals()).filter((proposal) => proposal.status === "evaluating"),
    ).map((proposal) => {
      const existing = activityRef.current.find(
        (entry) => entry.proposalId === proposal.proposalId,
      );

      return {
        proposal,
        label: existing?.label ?? formatTodoLabel(proposal.intent.type, proposal.intent.input, snapshot),
        detail: formatQueueDetail(proposal),
      } satisfies ReviewItem;
    });

    startTransition(() => setReviewQueue(nextQueue));
  });

  const upsertActivity = useEffectEvent((
    proposal: Proposal,
    settlement: TodoSettlement,
    observedBy: ActivityEntry["observedBy"],
    snapshotBefore: TodoSnapshot | null,
  ) => {
    const existing = activityRef.current.find((entry) => entry.proposalId === proposal.proposalId);
    const nextEntry: ActivityEntry = {
      proposalId: proposal.proposalId,
      label: existing?.label ?? formatTodoLabel(proposal.intent.type, proposal.intent.input, snapshotBefore),
      detail: formatSettlementDetail(settlement, settlement.proposal),
      observedBy,
      observedAt: Date.now(),
      submittedAt: proposal.submittedAt,
      settlement: settlement.kind,
      resultWorld: settlement.kind === "completed" || settlement.kind === "failed"
        ? settlement.resultWorld
        : undefined,
    };

    const nextActivity = [
      nextEntry,
      ...activityRef.current.filter((entry) => entry.proposalId !== proposal.proposalId),
    ].slice(0, 8);

    syncActivity(nextActivity);
  });

  useEffect(() => {
    const runtime = createGovernedRuntime();
    runtimeRef.current = runtime;
    syncSnapshot(runtime.getSnapshot());
    void refreshQueue(runtime);

    const unsubscribe = runtime.subscribe(
      (snapshot) => snapshot,
      (nextSnapshot) => syncSnapshot(nextSnapshot as TodoSnapshot),
    );

    return () => {
      unsubscribe();
      runtime.dispose();
      runtimeRef.current = null;
      snapshotRef.current = null;
      activityRef.current = [];
    };
  }, []);

  const withRuntime = useEffectEvent(async (
    action: (runtime: GovernanceInstance<TodoDomain>) => Promise<void>,
  ) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      setError("Governed runtime is not ready");
      return;
    }

    setError(null);

    try {
      await action(runtime);
    } catch (nextError) {
      setError(toErrorMessage(nextError));
    }
  });

  const submitIntent = useEffectEvent(async (
    buildIntent: (runtime: GovernanceInstance<TodoDomain>) => TypedIntent<TodoDomain>,
    timeoutMs: number,
  ) => {
    await withRuntime(async (runtime) => {
      const snapshotBefore = snapshotRef.current;
      const proposal = await runtime.proposeAsync(buildIntent(runtime));
      await refreshQueue(runtime);
      const settlement = await waitForProposal(runtime, proposal, {
        timeoutMs,
        pollIntervalMs: 100,
      });
      upsertActivity(proposal, settlement, "requester", snapshotBefore);
      await refreshQueue(runtime);
    });
  });

  const settleReviewedProposal = useEffectEvent(async (
    proposalId: string,
    decision: "approve" | "reject",
  ) => {
    await withRuntime(async (runtime) => {
      const proposal = decision === "approve"
        ? await runtime.approve(proposalId)
        : await runtime.reject(proposalId, "Rejected from the example reviewer panel");

      const snapshotBefore = snapshotRef.current;
      const settlement = await waitForProposal(runtime, proposal.proposalId, {
        timeoutMs: 250,
        pollIntervalMs: 50,
      });

      upsertActivity(proposal, settlement, "reviewer", snapshotBefore);
      await refreshQueue(runtime);
    });
  });

  return {
    state,
    ready: state !== null,
    error,
    availableActions,
    reviewQueue,
    activity,
    addTodo: (title) =>
      submitIntent(
        (runtime) => runtime.createIntent(runtime.MEL.actions.addTodo, title),
        250,
      ),
    toggleTodo: (id) =>
      submitIntent(
        (runtime) => runtime.createIntent(runtime.MEL.actions.toggleTodo, id),
        250,
      ),
    removeTodo: (id) =>
      submitIntent(
        (runtime) => runtime.createIntent(runtime.MEL.actions.removeTodo, id),
        1500,
      ),
    setFilter: (newFilter) =>
      submitIntent(
        (runtime) => runtime.createIntent(runtime.MEL.actions.setFilter, newFilter),
        250,
      ),
    clearCompleted: () =>
      submitIntent(
        (runtime) => runtime.createIntent(runtime.MEL.actions.clearCompleted),
        1500,
      ),
    approveProposal: (proposalId) => settleReviewedProposal(proposalId, "approve"),
    rejectProposal: (proposalId) => settleReviewedProposal(proposalId, "reject"),
  };
}
