'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Calendar } from 'lucide-react';
import { useTasksStore } from '@/store/useTasksStore';
import { useTasksDerived, TasksProvider } from '@/store/provider';
import { ViewSwitcher } from '@/components/shared/ViewSwitcher';
import { MobileNavigation } from '@/components/shared/MobileNavigation';
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
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useIsMobile, useIsDesktop } from '@/hooks/useMediaQuery';

function TasksHeader() {
  const derived = useTasksDerived();
  const dateFilter = useTasksStore((state) => state.dateFilter);
  const setDateFilter = useTasksStore((state) => state.setDateFilter);
  const isMobile = useIsMobile();

  return (
    <header className="border-b bg-muted/30">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <h1 className="text-base sm:text-lg font-semibold">TaskFlow</h1>
          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="font-normal">{derived.totalCount} tasks</Badge>
            <Badge variant="secondary" className="font-normal bg-primary/10 text-primary">
              {derived.inProgressCount} in progress
            </Badge>
            <Badge variant="secondary" className="font-normal bg-green-500/10 text-green-600 dark:text-green-400">
              {derived.doneCount} done
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile: icon only, Desktop: full picker */}
          {isMobile ? (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                // TODO: Open date picker modal on mobile
              }}
            >
              <Calendar className="h-4 w-4" />
            </Button>
          ) : (
            <DateRangePicker
              value={dateFilter}
              onChange={setDateFilter}
              placeholder="Filter by date"
            />
          )}
          {/* Hide ViewSwitcher on mobile (use bottom nav instead) */}
          <div className="hidden sm:block">
            <ViewSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}

function TasksContent() {
  const viewMode = useTasksStore((state) => state.viewMode);

  const viewVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const transition = { duration: 0.2, ease: 'easeInOut' as const };

  // Add bottom padding on mobile for navigation bar
  const mobileBottomPadding = 'pb-[calc(var(--mobile-nav-height)+1rem)] sm:pb-6';

  return (
    <AnimatePresence mode="wait">
      {viewMode === 'kanban' && (
        <motion.main
          key="kanban"
          variants={viewVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          className={`flex-1 px-4 sm:px-6 py-4 sm:py-6 overflow-hidden ${mobileBottomPadding}`}
        >
          <KanbanView />
        </motion.main>
      )}
      {viewMode === 'todo' && (
        <motion.div
          key="todo"
          variants={viewVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          className="flex-1 overflow-hidden"
        >
          <ScrollArea className="h-full">
            <main className={`h-full px-4 sm:px-6 py-4 sm:py-6 ${mobileBottomPadding}`}>
              <TodoView />
            </main>
          </ScrollArea>
        </motion.div>
      )}
      {viewMode === 'table' && (
        <motion.div
          key="table"
          variants={viewVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          className="flex-1 overflow-hidden"
        >
          <ScrollArea className="h-full">
            <main className={`h-full px-4 sm:px-6 py-4 sm:py-6 ${mobileBottomPadding}`}>
              <TableView />
            </main>
          </ScrollArea>
        </motion.div>
      )}
      {viewMode === 'trash' && (
        <motion.div
          key="trash"
          variants={viewVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          className="flex-1 overflow-hidden"
        >
          <ScrollArea className="h-full">
            <main className={`h-full px-4 sm:px-6 py-4 sm:py-6 ${mobileBottomPadding}`}>
              <TrashView />
            </main>
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
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
      // Position above mobile nav on small screens
      className="fixed bottom-[calc(var(--mobile-nav-height)+1rem)] sm:bottom-6 right-4 sm:right-6 z-50"
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

  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();

  return (
    <div className="flex h-screen bg-background">
      {/* LEFT SIDEBAR - Task Detail (Desktop only) */}
      {isDesktop && (
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
      )}

      {/* Mobile/Tablet: Task Detail as Sheet */}
      {!isDesktop && (
        <Sheet open={!!selectedTaskId} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
          <SheetContent
            side={isMobile ? 'bottom' : 'right'}
            className={
              isMobile
                ? 'h-[90vh] rounded-t-xl p-0'
                : 'w-[400px] max-w-full p-0'
            }
            hideCloseButton
          >
            <span className="sr-only">
              <SheetTitle>Task Details</SheetTitle>
              <SheetDescription>View and edit task details</SheetDescription>
            </span>
            {selectedTaskId && (
              <TaskDetailPanel
                taskId={selectedTaskId}
                onClose={() => setSelectedTaskId(null)}
              />
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TasksHeader />
        <TasksContent />
      </div>

      {/* RIGHT SIDEBAR - Assistant (Desktop only) */}
      {isDesktop && (
        <AnimatePresence mode="wait">
          {assistantOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-shrink-0 border-l overflow-hidden"
            >
              <div className="w-[360px] h-full overflow-hidden">
                <AssistantPanel onClose={() => setAssistantOpen(false)} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      {/* Mobile/Tablet: Assistant as Sheet */}
      {!isDesktop && (
        <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
          <SheetContent
            side={isMobile ? 'bottom' : 'right'}
            className={
              isMobile
                ? 'h-[85vh] rounded-t-xl p-0'
                : 'w-[360px] max-w-full p-0'
            }
            hideCloseButton
          >
            <span className="sr-only">
              <SheetTitle>AI Assistant</SheetTitle>
              <SheetDescription>Chat with AI assistant to manage tasks</SheetDescription>
            </span>
            <AssistantPanel onClose={() => setAssistantOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      {/* Mobile Navigation */}
      <MobileNavigation />

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
