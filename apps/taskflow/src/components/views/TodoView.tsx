'use client';

import { TaskCard } from '@/components/shared/TaskCard';
import { useTasksStore } from '@/store/useTasksStore';
import type { Task } from '@/manifesto';
import { getDateRangeFromType } from '@/components/ui/date-range-picker';
import { isWithinInterval, parseISO } from 'date-fns';

// Helper function to filter tasks by date
function filterTasksByDate(tasks: Task[], dateFilter: ReturnType<typeof useTasksStore.getState>['dateFilter']): Task[] {
  if (!dateFilter) return tasks;

  let startDate: Date;
  let endDate: Date;

  if (dateFilter.type === 'custom' && dateFilter.startDate && dateFilter.endDate) {
    startDate = new Date(dateFilter.startDate);
    endDate = new Date(dateFilter.endDate);
  } else {
    const range = getDateRangeFromType(dateFilter.type);
    if (!range) return tasks;
    startDate = range.startDate;
    endDate = range.endDate;
  }

  return tasks.filter((task) => {
    const dateValue = dateFilter.field === 'dueDate' ? task.dueDate : task.createdAt;
    if (!dateValue) return false;

    const taskDate = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
    return isWithinInterval(taskDate, { start: startDate, end: endDate });
  });
}

export function TodoView() {
  const allTasks = useTasksStore((state) => state.tasks);
  const selectedTaskId = useTasksStore((state) => state.selectedTaskId);
  const setSelectedTaskId = useTasksStore((state) => state.setSelectedTaskId);
  const updateTask = useTasksStore((state) => state.updateTask);
  const dateFilter = useTasksStore((state) => state.dateFilter);

  // Filter out deleted tasks, then apply date filter
  const activeTasks = allTasks.filter((t) => !t.deletedAt);
  const tasks = filterTasksByDate(activeTasks, dateFilter);

  // Sort tasks: incomplete first, then by priority
  const sortedTasks = [...tasks].sort((a, b) => {
    // Done tasks go to bottom
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;

    // Then sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const handleToggleComplete = (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    updateTask(taskId, { status: newStatus, updatedAt: new Date().toISOString() });
  };

  return (
    <div className="space-y-2 sm:space-y-2">
      {sortedTasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No tasks yet. Create your first task!
        </div>
      ) : (
        sortedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isSelected={selectedTaskId === task.id}
            showCheckbox
            onSelect={() => setSelectedTaskId(task.id)}
            onToggleComplete={() => handleToggleComplete(task.id, task.status)}
          />
        ))
      )}
    </div>
  );
}
