'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, List, Table2, Trash2 } from 'lucide-react';
import { useTasks, useTasksState, useTasksDerived } from '@/store/provider';
import type { ViewMode } from '@/manifesto';

export function ViewSwitcher() {
  const tasksContext = useTasks();
  const tasksState = useTasksState();
  const derived = useTasksDerived();

  const viewMode = tasksState?.viewMode ?? 'kanban';
  const deletedCount = derived.deletedCount;

  return (
    <Tabs value={viewMode} onValueChange={(value) => tasksContext.changeView(value as ViewMode)}>
      <TabsList>
        <TabsTrigger value="todo" className="gap-2">
          <List className="h-4 w-4" />
          <span className="hidden sm:inline">Todo</span>
        </TabsTrigger>
        <TabsTrigger value="kanban" className="gap-2">
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">Kanban</span>
        </TabsTrigger>
        <TabsTrigger value="table" className="gap-2">
          <Table2 className="h-4 w-4" />
          <span className="hidden sm:inline">Table</span>
        </TabsTrigger>
        <TabsTrigger value="trash" className="gap-2">
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Trash</span>
          {deletedCount > 0 && (
            <span className="ml-1 text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">
              {deletedCount}
            </span>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
