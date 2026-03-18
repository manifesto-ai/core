'use client';

import { TaskCard } from '@/components/shared/TaskCard';
import type { Task } from '@/types/taskflow';

interface TodoViewProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

export function TodoView({
  tasks,
  selectedTaskId,
  onSelectTask,
}: TodoViewProps) {
  // Sort tasks: incomplete first, then by priority
  const sortedTasks = [...tasks].sort((a, b) => {
    // Done tasks go to bottom
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;

    // Then sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className="space-y-2 sm:space-y-2">
      {sortedTasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No visible tasks in this shell view.
        </div>
      ) : (
        sortedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isSelected={selectedTaskId === task.id}
            showCheckbox
            onSelect={() => onSelectTask(task.id)}
          />
        ))
      )}
    </div>
  );
}
