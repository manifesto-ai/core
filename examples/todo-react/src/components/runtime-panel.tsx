import type { BaseWriteReport } from "@manifesto-ai/sdk";
import type {
  ActionStatus,
  DraftInspection,
  RuntimeEvent,
} from "../hooks/use-manifesto";
import type { TodoComputed, TodoState } from "../types";

type Props = {
  state: TodoState;
  computed: TodoComputed;
  draft: string;
  draftInspection: DraftInspection | null;
  actionStatuses: readonly ActionStatus[];
  lastReport: BaseWriteReport | null;
  lastError: string | null;
  events: readonly RuntimeEvent[];
};

function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "error" | "neutral";
  children: string;
}) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function changedPaths(report: BaseWriteReport | null): string {
  if (!report || report.changes.length === 0) {
    return "none";
  }
  return report.changes.map((change) => change.path.join(".") || "state").join(", ");
}

export function RuntimePanel({
  state,
  computed,
  draft,
  draftInspection,
  actionStatuses,
  lastReport,
  lastError,
  events,
}: Props) {
  const draftTone = draftInspection?.admission.ok ? "ok" : "warn";
  const draftDetail = draftInspection
    ? draftInspection.admission.ok
      ? `${draftInspection.changedPaths.length} projected changes`
      : draftInspection.admission.message
    : "not ready";

  return (
    <aside className="runtime-panel">
      <section className="panel-block">
        <div className="panel-heading">
          <h2>Snapshot</h2>
          <StatusPill tone="neutral">{state.filterMode}</StatusPill>
        </div>
        <dl className="metric-grid">
          <div>
            <dt>Total</dt>
            <dd>{computed.todoCount}</dd>
          </div>
          <div>
            <dt>Active</dt>
            <dd>{computed.activeCount}</dd>
          </div>
          <div>
            <dt>Done</dt>
            <dd>{computed.completedCount}</dd>
          </div>
        </dl>
      </section>

      <section className="panel-block">
        <div className="panel-heading">
          <h2>Draft</h2>
          <StatusPill tone={draftTone}>
            {draftInspection?.admission.ok ? "admitted" : "blocked"}
          </StatusPill>
        </div>
        <div className="kv-list">
          <div>
            <span>Input</span>
            <strong>{draft.trim() || "empty"}</strong>
          </div>
          <div>
            <span>Preview</span>
            <strong>{draftInspection?.nextTodoCount ?? "-"}</strong>
          </div>
          <div>
            <span>Result</span>
            <strong>{draftDetail}</strong>
          </div>
        </div>
      </section>

      <section className="panel-block">
        <div className="panel-heading">
          <h2>Actions</h2>
          <StatusPill tone="neutral">{actionStatuses.length.toString()}</StatusPill>
        </div>
        <div className="action-list">
          {actionStatuses.map((action) => (
            <div className="action-row" key={action.name}>
              <div>
                <strong>{action.name}</strong>
                <span>
                  {action.parameters.length > 0
                    ? action.parameters.join(", ")
                    : "no input"}
                </span>
              </div>
              <StatusPill tone={action.available ? "ok" : "warn"}>
                {action.available ? "available" : "locked"}
              </StatusPill>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-block">
        <div className="panel-heading">
          <h2>Last Report</h2>
          <StatusPill tone={lastError ? "error" : lastReport ? "ok" : "neutral"}>
            {lastError ? "error" : lastReport?.outcome.kind ?? "none"}
          </StatusPill>
        </div>
        <div className="kv-list">
          <div>
            <span>Action</span>
            <strong>{lastReport?.action ?? "-"}</strong>
          </div>
          <div>
            <span>Changes</span>
            <strong>{changedPaths(lastReport)}</strong>
          </div>
          <div>
            <span>Requirements</span>
            <strong>{lastReport?.requirements.length ?? 0}</strong>
          </div>
          <div>
            <span>Diagnostics</span>
            <strong>
              {lastReport?.diagnostics?.hostTraces?.length
                ? `${lastReport.diagnostics.hostTraces.length} traces`
                : "none"}
            </strong>
          </div>
          {lastError && (
            <div>
              <span>Message</span>
              <strong>{lastError}</strong>
            </div>
          )}
        </div>
      </section>

      <section className="panel-block">
        <div className="panel-heading">
          <h2>Events</h2>
          <StatusPill tone="neutral">{events.length.toString()}</StatusPill>
        </div>
        <ol className="event-list">
          {events.length === 0 && <li className="muted">No events yet</li>}
          {events.map((event) => (
            <li key={event.id}>
              <StatusPill tone={event.tone}>{event.phase}</StatusPill>
              <div>
                <strong>{event.action}</strong>
                <span>{event.detail}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
