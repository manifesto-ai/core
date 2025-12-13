'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { useTasksStore } from '@/store/useTasksStore';
import { useTasksDerived, TasksProvider } from '@/store/provider';
import { ViewSwitcher } from '@/components/shared/ViewSwitcher';
import { TodoView } from '@/components/views/TodoView';
import { KanbanView } from '@/components/views/KanbanView';
import { TableView } from '@/components/views/TableView';
import { TrashView } from '@/components/views/TrashView';
import { AssistantPanel } from '@/components/assistant';
import { TaskDetailPanel } from '@/components/sidebar/TaskDetailPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { ScrollArea } from '@/components/ui/scroll-area';

function TasksHeader() {
  const derived = useTasksDerived();
  const dateFilter = useTasksStore((state) => state.dateFilter);
  const setDateFilter = useTasksStore((state) => state.setDateFilter);

  return (
    <header className="border-b bg-muted/30">
      <div className="flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">TaskFlow</h1>
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="font-normal">{derived.totalCount} tasks</Badge>
            <Badge variant="secondary" className="font-normal bg-primary/10 text-primary">
              {derived.inProgressCount} in progress
            </Badge>
            <Badge variant="secondary" className="font-normal bg-green-500/10 text-green-600 dark:text-green-400">
              {derived.doneCount} done
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker
            value={dateFilter}
            onChange={setDateFilter}
            placeholder="Filter by date"
          />
          <ViewSwitcher />
        </div>
      </div>
    </header>
  );
}

function TasksContent() {
  const viewMode = useTasksStore((state) => state.viewMode);

  return (
    <ScrollArea className="flex-1">
      <main className="h-full px-6 py-6">
        {viewMode === 'todo' && <TodoView />}
        {viewMode === 'kanban' && <KanbanView />}
        {viewMode === 'table' && <TableView />}
        {viewMode === 'trash' && <TrashView />}
      </main>
    </ScrollArea>
  );
}

function AssistantToggle() {
  const assistantOpen = useTasksStore((state) => state.assistantOpen);
  const setAssistantOpen = useTasksStore((state) => state.setAssistantOpen);

  if (assistantOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed bottom-6 right-6 z-50"
    >
      <Button
        onClick={() => setAssistantOpen(true)}
        size="lg"
        className="h-14 w-14 rounded-full shadow-lg"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    </motion.div>
  );
}

function AppLayout() {
  const assistantOpen = useTasksStore((state) => state.assistantOpen);
  const setAssistantOpen = useTasksStore((state) => state.setAssistantOpen);
  const selectedTaskId = useTasksStore((state) => state.selectedTaskId);
  const setSelectedTaskId = useTasksStore((state) => state.setSelectedTaskId);

  return (
    <div className="flex h-screen bg-background">
      {/* LEFT SIDEBAR - Task Detail */}
      <AnimatePresence mode="wait">
        {selectedTaskId && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-shrink-0 border-r overflow-hidden"
          >
            <div className="w-[400px] h-full">
              <TaskDetailPanel
                taskId={selectedTaskId}
                onClose={() => setSelectedTaskId(null)}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TasksHeader />
        <TasksContent />
      </div>

      {/* RIGHT SIDEBAR - Assistant */}
      <AnimatePresence mode="wait">
        {assistantOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-shrink-0 border-l overflow-hidden"
          >
            <div className="w-[360px] h-full">
              <AssistantPanel onClose={() => setAssistantOpen(false)} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* FAB to toggle Assistant */}
      <AnimatePresence>
        <AssistantToggle />
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  return (
    <TasksProvider>
      <AppLayout />
    </TasksProvider>
  );
}
