'use client';

import { useState } from 'react';
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
import { filterTasksByDate } from '@/lib/date-filter';
import {
  ASSISTANT_SHELL_MESSAGES,
  TASK_FIXTURES,
} from '@/lib/taskflow-fixtures';
import type { AssistantMessage, DateFilter, ViewMode } from '@/types/taskflow';

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
            <p className="text-xs text-muted-foreground">UI shell for the upcoming rebuild</p>
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
              placeholder="Filter shell tasks"
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

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>('task-2');
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [assistantMessages, setAssistantMessages] =
    useState<AssistantMessage[]>(ASSISTANT_SHELL_MESSAGES);

  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();

  const activeTasks = filterTasksByDate(
    TASK_FIXTURES.filter((task) => task.deletedAt === null),
    dateFilter,
  );
  const deletedTasks = TASK_FIXTURES.filter((task) => task.deletedAt !== null);
  const selectedTask =
    TASK_FIXTURES.find((task) => task.id === selectedTaskId) ?? null;
  const inProgressCount = TASK_FIXTURES.filter(
    (task) => task.deletedAt === null && task.status === 'in-progress',
  ).length;
  const doneCount = TASK_FIXTURES.filter(
    (task) => task.deletedAt === null && task.status === 'done',
  ).length;

  const handleAssistantSubmit = (message: string) => {
    setAssistantMessages((current) => [
      ...current,
      {
        id: `assistant-${current.length + 1}`,
        role: 'user',
        content: message,
      },
      {
        id: `assistant-${current.length + 2}`,
        role: 'assistant',
        tone: 'muted',
        content:
          'TaskFlow shell only preserves the panel contract. Reconnect real intent handling during the rebuild.',
      },
    ]);
  };

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
                <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTaskId(null)} />
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      ) : (
        <Sheet
          open={selectedTask !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTaskId(null);
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
              <SheetDescription>Inspect the preserved TaskFlow shell details.</SheetDescription>
            </span>
            <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTaskId(null)} />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TasksHeader
          activeCount={TASK_FIXTURES.filter((task) => task.deletedAt === null).length}
          inProgressCount={inProgressCount}
          doneCount={doneCount}
          dateFilter={dateFilter}
          deletedCount={deletedTasks.length}
          viewMode={viewMode}
          onDateFilterChange={setDateFilter}
          onViewModeChange={setViewMode}
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
                tasks={activeTasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
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
                    tasks={activeTasks}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={setSelectedTaskId}
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
                    tasks={activeTasks}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={setSelectedTaskId}
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
                  <TrashView tasks={deletedTasks} />
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
                  onClose={() => setAssistantOpen(false)}
                  messages={assistantMessages}
                  onSubmit={handleAssistantSubmit}
                />
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      ) : (
        <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
          <SheetContent
            side={isMobile ? 'bottom' : 'right'}
            className={isMobile ? 'h-[85vh] rounded-t-xl p-0' : 'w-[360px] max-w-full p-0'}
            hideCloseButton
          >
            <span className="sr-only">
              <SheetTitle>Assistant shell</SheetTitle>
              <SheetDescription>Local-only assistant placeholder for the rebuild.</SheetDescription>
            </span>
            <AssistantPanel
              onClose={() => setAssistantOpen(false)}
              messages={assistantMessages}
              onSubmit={handleAssistantSubmit}
            />
          </SheetContent>
        </Sheet>
      )}

      <MobileNavigation
        viewMode={viewMode}
        deletedCount={deletedTasks.length}
        onChange={setViewMode}
      />

      <AnimatePresence>
        <AssistantToggle
          assistantOpen={assistantOpen}
          onOpen={() => setAssistantOpen(true)}
        />
      </AnimatePresence>
    </div>
  );
}
