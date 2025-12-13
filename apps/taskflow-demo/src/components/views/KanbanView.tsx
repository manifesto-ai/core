'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskCard } from '@/components/shared/TaskCard';
import { useTasksStore } from '@/store/useTasksStore';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Task } from '@/domain/tasks';
import { getDateRangeFromType } from '@/components/ui/date-range-picker';
import { isWithinInterval, parseISO } from 'date-fns';

type Status = 'todo' | 'in-progress' | 'review' | 'done';

const statusLabels: Record<Status, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'Review',
  done: 'Done',
};

// Notion-style subtle colors
const statusColors: Record<Status, string> = {
  todo: 'bg-secondary text-secondary-foreground',
  'in-progress': 'bg-primary/10 text-primary',
  review: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  done: 'bg-green-500/10 text-green-600 dark:text-green-400',
};

interface SortableTaskProps {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
}

function SortableTask({ task, isSelected, onSelect }: SortableTaskProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} isSelected={isSelected} onSelect={onSelect} />
    </div>
  );
}

interface KanbanColumnProps {
  status: Status;
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

function KanbanColumn({ status, tasks, selectedTaskId, onSelectTask }: KanbanColumnProps) {
  return (
    <div className="flex-1 min-w-[280px] max-w-[320px]">
      <div className={cn('rounded-t-lg p-3', statusColors[status])}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{statusLabels[status]}</h3>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
      </div>
      <div className="bg-muted/50 rounded-b-lg p-2 min-h-[400px] space-y-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTask
              key={task.id}
              task={task}
              isSelected={selectedTaskId === task.id}
              onSelect={() => onSelectTask(task.id)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

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

export function KanbanView() {
  const allTasks = useTasksStore((state) => state.tasks);
  const selectedTaskId = useTasksStore((state) => state.selectedTaskId);
  const setSelectedTaskId = useTasksStore((state) => state.setSelectedTaskId);
  const updateTask = useTasksStore((state) => state.updateTask);
  const dateFilter = useTasksStore((state) => state.dateFilter);

  // Filter out deleted tasks, then apply date filter
  const activeTasks = allTasks.filter((t) => !t.deletedAt);
  const tasks = filterTasksByDate(activeTasks, dateFilter);

  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Group tasks by status
  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === 'todo'),
    'in-progress': tasks.filter((t) => t.status === 'in-progress'),
    review: tasks.filter((t) => t.status === 'review'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const draggedTask = allTasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    // Determine the target column based on where we dropped
    // This is simplified - in a full implementation, we'd track which column was dropped on
    const overTask = allTasks.find((t) => t.id === over.id);
    if (overTask && draggedTask.status !== overTask.status) {
      updateTask(draggedTask.id, {
        status: overTask.status,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {(Object.keys(tasksByStatus) as Status[]).map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} className="shadow-lg rotate-3" />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
