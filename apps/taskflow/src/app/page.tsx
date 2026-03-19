'use client';

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, MessageSquare } from 'lucide-react';
import { AssistantPanel } from '@/components/assistant';
import { MobileNavigation } from '@/components/shared/MobileNavigation';
import { ViewSwitcher } from '@/components/shared/ViewSwitcher';
import { TaskDetailPanel } from '@/components/sidebar/TaskDetailPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { KanbanView } from '@/components/views/KanbanView';
import { TableView } from '@/components/views/TableView';
import { TodoView } from '@/components/views/TodoView';
import { TrashView } from '@/components/views/TrashView';
import { useIsDesktop, useIsMobile } from '@/hooks/useMediaQuery';
import { useTaskFlow } from '@/hooks/useTaskFlow';
import { filterTasksByDate } from '@/lib/date-filter';
import type { AgentRequest, AgentResponse, IntentResult } from '@/types/intent';
import type { AssistantMessage, DateFilter, Task, ViewMode } from '@/types/taskflow';

function TasksHeader({
  activeCount,
  inProgressCount,
  doneCount,
  dateFilter,
  deletedCount,
  viewMode,
  onDateFilterChange,
  onViewModeChange,
}: {
  activeCount: number;
  inProgressCount: number;
  doneCount: number;
  dateFilter: DateFilter | null;
  deletedCount: number;
  viewMode: ViewMode;
  onDateFilterChange: (filter: DateFilter | null) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
}) {
  const isMobile = useIsMobile();

  return (
    <header className="border-b bg-muted/30">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <div>
            <h1 className="text-base font-semibold sm:text-lg">TaskFlow</h1>
            <p className="text-xs text-muted-foreground">Powered by Manifesto SDK</p>
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
            <Badge variant="secondary" className="font-normal">
              {activeCount} active
            </Badge>
            <Badge variant="secondary" className="bg-primary/10 font-normal text-primary">
              {inProgressCount} in progress
            </Badge>
            <Badge
              variant="secondary"
              className="bg-green-500/10 font-normal text-green-600 dark:text-green-400"
            >
              {doneCount} done
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isMobile ? (
            <Button variant="outline" size="icon" className="h-9 w-9" disabled>
              <Calendar className="h-4 w-4" />
            </Button>
          ) : (
            <DateRangePicker
              value={dateFilter}
              onChange={onDateFilterChange}
              placeholder="Filter by date"
            />
          )}
          <div className="hidden sm:block">
            <ViewSwitcher
              viewMode={viewMode}
              deletedCount={deletedCount}
              onChange={onViewModeChange}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function AssistantToggle({
  assistantOpen,
  onOpen,
}: {
  assistantOpen: boolean;
  onOpen: () => void;
}) {
  if (assistantOpen) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed bottom-[calc(var(--mobile-nav-height)+1rem)] right-4 z-50 sm:bottom-6 sm:right-6"
    >
      <Button onClick={onOpen} size="lg" className="h-14 w-14 rounded-full shadow-lg">
        <MessageSquare className="h-6 w-6" />
      </Button>
    </motion.div>
  );
}

/**
 * Resolve a task title from an intent to an actual task ID.
 * Uses case-insensitive substring matching.
 */
function resolveTaskId(taskTitle: string, tasks: Task[]): string | null {
  const lower = taskTitle.toLowerCase();
  const match = tasks.find((t) => t.title.toLowerCase().includes(lower));
  return match?.id ?? null;
}

/**
 * Generate a human-readable description of what the intent did.
 */
function describeExecution(intent: IntentResult, resolved: boolean): string {
  if (!resolved && 'taskTitle' in intent && intent.taskTitle) {
    return `Could not find a task matching "${intent.taskTitle}".`;
  }
  switch (intent.kind) {
    case 'createTask':
      return `Created task "${intent.task.title}".`;
    case 'updateTask':
      return `Updated task "${intent.taskTitle}".`;
    case 'moveTask':
      return `Moved task "${intent.taskTitle}" to ${intent.newStatus}.`;
    case 'deleteTask':
      return `Deleted task "${intent.taskTitle}".`;
    case 'restoreTask':
      return `Restored task "${intent.taskTitle}".`;
    case 'emptyTrash':
      return 'Emptied the trash.';
    case 'selectTask':
      return intent.taskTitle
        ? `Selected task "${intent.taskTitle}".`
        : 'Deselected task.';
    case 'changeView':
      return `Switched to ${intent.viewMode} view.`;
    case 'query':
      return '';
  }
}

export default function Home() {
  const { state, ready, actions, dispatch } = useTaskFlow();
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantLoading, setAssistantLoading] = useState(false);

  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();

  const executeIntent = useCallback(
    (intent: IntentResult, tasks: Task[]): { executed: boolean; message: string } => {
      switch (intent.kind) {
        case 'createTask': {
          const now = new Date().toISOString();
          const task: Task = {
            id: crypto.randomUUID(),
            title: intent.task.title,
            description: intent.task.description ?? null,
            status: intent.task.status ?? 'todo',
            priority: intent.task.priority ?? 'medium',
            assignee: intent.task.assignee ?? null,
            dueDate: intent.task.dueDate ?? null,
            tags: intent.task.tags ?? [],
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          };
          dispatch('createTask', { task });
          return { executed: true, message: describeExecution(intent, true) };
        }
        case 'updateTask': {
          const id = resolveTaskId(intent.taskTitle, tasks);
          if (!id) return { executed: false, message: describeExecution(intent, false) };
          dispatch('updateTask', {
            id,
            title: intent.fields.title ?? null,
            description: intent.fields.description ?? null,
            status: intent.fields.status ?? null,
            priority: intent.fields.priority ?? null,
            assignee: intent.fields.assignee ?? null,
            dueDate: intent.fields.dueDate ?? null,
            tags: intent.fields.tags ?? null,
            updatedAt: new Date().toISOString(),
          });
          return { executed: true, message: describeExecution(intent, true) };
        }
        case 'moveTask': {
          const id = resolveTaskId(intent.taskTitle, tasks);
          if (!id) return { executed: false, message: describeExecution(intent, false) };
          dispatch('moveTask', { taskId: id, newStatus: intent.newStatus });
          return { executed: true, message: describeExecution(intent, true) };
        }
        case 'deleteTask': {
          const id = resolveTaskId(intent.taskTitle, tasks);
          if (!id) return { executed: false, message: describeExecution(intent, false) };
          dispatch('softDeleteTask', { id, timestamp: new Date().toISOString() });
          return { executed: true, message: describeExecution(intent, true) };
        }
        case 'restoreTask': {
          const id = resolveTaskId(intent.taskTitle, tasks);
          if (!id) return { executed: false, message: describeExecution(intent, false) };
          dispatch('restoreTask', { id });
          return { executed: true, message: describeExecution(intent, true) };
        }
        case 'emptyTrash': {
          dispatch('emptyTrash', {});
          return { executed: true, message: describeExecution(intent, true) };
        }
        case 'selectTask': {
          if (!intent.taskTitle) {
            dispatch('selectTask', { taskId: null });
            return { executed: true, message: describeExecution(intent, true) };
          }
          const id = resolveTaskId(intent.taskTitle, tasks);
          if (!id) return { executed: false, message: describeExecution(intent, false) };
          dispatch('selectTask', { taskId: id });
          return { executed: true, message: describeExecution(intent, true) };
        }
        case 'changeView': {
          dispatch('changeView', { mode: intent.viewMode });
          return { executed: true, message: describeExecution(intent, true) };
        }
        case 'query': {
          return { executed: false, message: '' };
        }
      }
    },
    [dispatch],
  );

  const handleAssistantSubmit = useCallback(
    async (message: string) => {
      if (!state) return;

      // Add user message
      setAssistantMessages((current) => [
        ...current,
        { id: `user-${Date.now()}`, role: 'user', content: message },
      ]);
      setAssistantLoading(true);

      try {
        const reqBody: AgentRequest = {
          message,
          tasks: state.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            deletedAt: t.deletedAt,
          })),
          viewMode: state.viewMode,
        };

        const res = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
        });

        const data: AgentResponse = await res.json();

        if (!res.ok || !data.intent) {
          // API error or no intent parsed
          setAssistantMessages((current) => [
            ...current,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: data.message || 'Sorry, I could not understand that request.',
            },
          ]);
          return;
        }

        const intent = data.intent;

        // For query intents, show the LLM's message directly
        if (intent.kind === 'query') {
          setAssistantMessages((current) => [
            ...current,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: data.message || `Let me look at that: ${intent.question}`,
            },
          ]);
          return;
        }

        // Execute the intent against the Manifesto runtime
        const result = executeIntent(intent, state.tasks);

        setAssistantMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: result.message,
            tone: result.executed ? 'default' : 'muted',
          },
        ]);
      } catch {
        setAssistantMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            tone: 'muted',
            content: 'Failed to reach the assistant. Check your connection and API key.',
          },
        ]);
      } finally {
        setAssistantLoading(false);
      }
    },
    [state, executeIntent],
  );

  if (!ready || !state) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const {
    activeTasks,
    deletedTasks,
    selectedTaskId,
    viewMode,
    assistantOpen,
    totalCount,
    inProgressCount,
    doneCount,
    deletedCount,
  } = state;

  const filteredActiveTasks = filterTasksByDate(activeTasks, dateFilter);
  const selectedTask = state.tasks.find((t) => t.id === selectedTaskId) ?? null;

  return (
    <div className="flex h-screen bg-background">
      {isDesktop ? (
        <AnimatePresence mode="wait">
          {selectedTask ? (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-shrink-0 overflow-hidden border-r"
            >
              <div className="h-full w-[400px]">
                <TaskDetailPanel
                  task={selectedTask}
                  onClose={() => actions.selectTask(null)}
                  onDelete={actions.softDeleteTask}
                />
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      ) : (
        <Sheet
          open={selectedTask !== null}
          onOpenChange={(open) => {
            if (!open) {
              actions.selectTask(null);
            }
          }}
        >
          <SheetContent
            side={isMobile ? 'bottom' : 'right'}
            className={isMobile ? 'h-[90vh] rounded-t-xl p-0' : 'w-[400px] max-w-full p-0'}
            hideCloseButton
          >
            <span className="sr-only">
              <SheetTitle>Task details</SheetTitle>
              <SheetDescription>View and manage task details.</SheetDescription>
            </span>
            <TaskDetailPanel
              task={selectedTask}
              onClose={() => actions.selectTask(null)}
              onDelete={actions.softDeleteTask}
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TasksHeader
          activeCount={totalCount}
          inProgressCount={inProgressCount}
          doneCount={doneCount}
          dateFilter={dateFilter}
          deletedCount={deletedCount}
          viewMode={viewMode}
          onDateFilterChange={setDateFilter}
          onViewModeChange={actions.changeView}
        />

        <AnimatePresence mode="wait">
          {viewMode === 'kanban' ? (
            <motion.main
              key="kanban"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-1 overflow-hidden px-4 py-4 sm:px-6 sm:py-6"
            >
              <KanbanView
                tasks={filteredActiveTasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={actions.selectTask}
                onMoveTask={actions.moveTask}
              />
            </motion.main>
          ) : null}

          {viewMode === 'todo' ? (
            <motion.div
              key="todo"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-1 overflow-hidden"
            >
              <ScrollArea className="h-full">
                <main className="px-4 py-4 sm:px-6 sm:py-6">
                  <TodoView
                    tasks={filteredActiveTasks}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={actions.selectTask}
                  />
                </main>
              </ScrollArea>
            </motion.div>
          ) : null}

          {viewMode === 'table' ? (
            <motion.div
              key="table"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-1 overflow-hidden"
            >
              <ScrollArea className="h-full">
                <main className="px-4 py-4 sm:px-6 sm:py-6">
                  <TableView
                    tasks={filteredActiveTasks}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={actions.selectTask}
                  />
                </main>
              </ScrollArea>
            </motion.div>
          ) : null}

          {viewMode === 'trash' ? (
            <motion.div
              key="trash"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-1 overflow-hidden"
            >
              <ScrollArea className="h-full">
                <main className="px-4 py-4 sm:px-6 sm:py-6">
                  <TrashView
                    tasks={deletedTasks}
                    onRestore={actions.restoreTask}
                    onPermanentlyDelete={actions.permanentlyDeleteTask}
                    onEmptyTrash={actions.emptyTrash}
                  />
                </main>
              </ScrollArea>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {isDesktop ? (
        <AnimatePresence mode="wait">
          {assistantOpen ? (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-shrink-0 overflow-hidden border-l"
            >
              <div className="h-full w-[360px] overflow-hidden">
                <AssistantPanel
                  onClose={() => actions.toggleAssistant(false)}
                  messages={assistantMessages}
                  onSubmit={handleAssistantSubmit}
                  isLoading={assistantLoading}
                />
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      ) : (
        <Sheet open={assistantOpen} onOpenChange={(open) => actions.toggleAssistant(open)}>
          <SheetContent
            side={isMobile ? 'bottom' : 'right'}
            className={isMobile ? 'h-[85vh] rounded-t-xl p-0' : 'w-[360px] max-w-full p-0'}
            hideCloseButton
          >
            <span className="sr-only">
              <SheetTitle>Assistant</SheetTitle>
              <SheetDescription>AI assistant panel.</SheetDescription>
            </span>
            <AssistantPanel
              onClose={() => actions.toggleAssistant(false)}
              messages={assistantMessages}
              onSubmit={handleAssistantSubmit}
              isLoading={assistantLoading}
            />
          </SheetContent>
        </Sheet>
      )}

      <MobileNavigation
        viewMode={viewMode}
        deletedCount={deletedCount}
        onChange={actions.changeView}
      />

      <AnimatePresence>
        <AssistantToggle
          assistantOpen={assistantOpen}
          onOpen={() => actions.toggleAssistant(true)}
        />
      </AnimatePresence>
    </div>
  );
}
