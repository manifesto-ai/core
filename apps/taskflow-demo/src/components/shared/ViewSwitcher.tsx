'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, List, Table2, Trash2 } from 'lucide-react';
import { useTasksStore, type ViewMode } from '@/store/useTasksStore';

export function ViewSwitcher() {
  const viewMode = useTasksStore((state) => state.viewMode);
  const setViewMode = useTasksStore((state) => state.setViewMode);
  const tasks = useTasksStore((state) => state.tasks);

  // Count deleted tasks
  const deletedCount = tasks.filter((t) => t.deletedAt).length;

  return (
    <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
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
