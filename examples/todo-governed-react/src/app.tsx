import { AnimatePresence, motion } from "motion/react";
import { ProposalQueue } from "./components/governance/proposal-queue";
import { ActivityFeed } from "./components/governance/activity-feed";
import { TodoFooter } from "./components/todo/todo-footer";
import { TodoInput } from "./components/todo/todo-input";
import { TodoList } from "./components/todo/todo-list";
import { useGovernedManifesto } from "./hooks/use-governed-manifesto";
import type { TodoComputed } from "./types";

export function App() {
  const {
    state,
    ready,
    error,
    reviewQueue,
    activity,
    addTodo,
    toggleTodo,
    removeTodo,
    setFilter,
    clearCompleted,
    approveProposal,
    rejectProposal,
  } = useGovernedManifesto();

  if (!ready || !state) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage-500/10 text-sage-500 text-sm font-medium tracking-wide">
            <span className="w-2 h-2 rounded-full bg-sage-500 animate-pulse-dot" />
            Initializing governed runtime
          </div>
        </div>
      </div>
    );
  }

  const data = state.data;
  const computed = state.computed as TodoComputed;
  const filteredTodos = data.todos.filter((todo) => {
    if (data.filterMode === "active") return !todo.completed;
    if (data.filterMode === "completed") return todo.completed;
    return true;
  });

  const pendingDeletes = new Set(
    reviewQueue
      .filter((item) => item.proposal.intent.type === "removeTodo")
      .map((item) => item.proposal.intent.input as string),
  );

  return (
    <div className="w-[min(1280px,calc(100vw-2rem))] mx-auto py-8 md:py-10">
      {/* Header */}
      <header className="mb-6 animate-fade-in">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-lg bg-sage-500 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7.5L5.5 11L12 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-sage-900 tracking-tight">Governed Todo</h1>
            </div>
            <p className="text-sage-400 text-sm max-w-md leading-relaxed">
              Actions flow through governance. Some settle instantly, others await human review.
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5 text-xs text-sage-400">
              <span className="w-1.5 h-1.5 rounded-full bg-sage-500" />
              <span>Auto-approve</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-sage-400">
              <span className="w-1.5 h-1.5 rounded-full bg-ember-400" />
              <span>Needs review</span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-sage-900/5 text-xs font-mono text-sage-600">
              v.{state.meta.version}
            </div>
          </div>
        </div>
      </header>

      {/* Main workspace */}
      <main className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5 items-start">
        {/* Writer panel */}
        <section className="bg-sand-200/88 border border-sage-900/[0.06] rounded-2xl shadow-[0_16px_48px_rgba(36,55,51,0.07)] backdrop-blur-lg overflow-hidden animate-fade-in-delay-1">
          <div className="px-6 pt-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[0.65rem] uppercase tracking-[0.16em] text-sage-400 font-medium">Writer</span>
              </div>
            </div>
            <h2 className="font-serif text-xl font-semibold text-sage-900 -tracking-[0.01em]">Tasks</h2>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mx-5 mb-3 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-sand-50 rounded-xl mx-3 mb-3 border border-sage-900/[0.05] overflow-hidden">
            <div className="px-4 pt-4">
              <TodoInput onAdd={(title) => void addTodo(title)} />
            </div>

            {data.todos.length > 0 ? (
              <>
                <div className="border-t border-sage-900/[0.06] mt-3">
                  <TodoList
                    todos={filteredTodos}
                    pendingDeletes={pendingDeletes}
                    onToggle={(id) => void toggleTodo(id)}
                    onRemove={(id) => void removeTodo(id)}
                  />
                </div>
                <TodoFooter
                  activeCount={computed.activeCount}
                  hasCompleted={computed.hasCompleted}
                  filterMode={data.filterMode}
                  onSetFilter={(filter) => void setFilter(filter)}
                  onClearCompleted={() => void clearCompleted()}
                />
              </>
            ) : (
              <div className="px-5 py-8 text-center text-sage-300 text-sm">
                <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-sage-900/[0.04] flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-sage-300">
                    <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                Add your first task. Try deleting one to trigger a governance review.
              </div>
            )}
          </div>
        </section>

        {/* Reviewer panel */}
        <aside className="grid gap-4 animate-fade-in-delay-2">
          <ProposalQueue
            reviewQueue={reviewQueue}
            onApprove={(proposalId) => void approveProposal(proposalId)}
            onReject={(proposalId) => void rejectProposal(proposalId)}
          />
          <ActivityFeed activity={activity} />
        </aside>
      </main>
    </div>
  );
}
