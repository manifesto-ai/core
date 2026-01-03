'use client';

import { List, LayoutGrid, Table2, Trash2 } from 'lucide-react';
import { useTasksStore, type ViewMode } from '@/store/useTasksStore';
import { cn } from '@/lib/utils';

const navItems: Array<{
  mode: ViewMode;
  icon: typeof List;
  label: string;
}> = [
  { mode: 'todo', icon: List, label: 'Todo' },
  { mode: 'kanban', icon: LayoutGrid, label: 'Kanban' },
  { mode: 'table', icon: Table2, label: 'Table' },
  { mode: 'trash', icon: Trash2, label: 'Trash' },
];

export function MobileNavigation() {
  const viewMode = useTasksStore((state) => state.viewMode);
  const setViewMode = useTasksStore((state) => state.setViewMode);
  const tasks = useTasksStore((state) => state.tasks);

  const deletedCount = tasks.filter((t) => t.deletedAt).length;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-40 safe-area-bottom sm:hidden">
      <div className="flex justify-around py-2">
        {navItems.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              'flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors',
              'min-w-[64px] touch-manipulation no-min-height',
              viewMode === mode
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground active:bg-muted'
            )}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {mode === 'trash' && deletedCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-destructive text-destructive-foreground text-[10px] rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center font-medium">
                  {deletedCount > 99 ? '99+' : deletedCount}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
