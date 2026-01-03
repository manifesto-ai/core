'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
import { cn } from '@/lib/utils';
import type { Task } from '@/manifesto';
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
  scrollToBottom?: boolean;
  onScrollComplete?: () => void;
}

function KanbanColumn({
  status,
  tasks,
  selectedTaskId,
  onSelectTask,
  scrollToBottom,
  onScrollComplete,
}: KanbanColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevTaskCountRef = useRef(tasks.length);

  // Scroll to bottom when new tasks are added or scrollToBottom flag is set
  useEffect(() => {
    const hasNewTask = tasks.length > prevTaskCountRef.current;
    prevTaskCountRef.current = tasks.length;

    if ((hasNewTask || scrollToBottom) && scrollRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth',
          });
          onScrollComplete?.();
        }
      }, 100);
    }
  }, [tasks.length, scrollToBottom, onScrollComplete]);

  return (
    <div className="flex-shrink-0 w-[85vw] sm:w-auto sm:flex-1 sm:min-w-[280px] sm:max-w-[320px] flex flex-col h-full snap-center sm:snap-align-none">
      <div className={cn('rounded-t-lg p-3 shrink-0', statusColors[status])}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{statusLabels[status]}</h3>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="bg-muted/50 rounded-b-lg p-2 flex-1 overflow-y-auto space-y-2 scrollbar-thin"
      >
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
  const [scrollToColumn, setScrollToColumn] = useState<Status | null>(null);
  const prevTaskIdsRef = useRef<Set<string>>(new Set(tasks.map(t => t.id)));

  // Detect newly added tasks and determine which column to scroll
  useEffect(() => {
    const currentIds = new Set(tasks.map(t => t.id));
    const prevIds = prevTaskIdsRef.current;

    // Find new task IDs
    const newTaskIds = [...currentIds].filter(id => !prevIds.has(id));

    if (newTaskIds.length > 0) {
      // Find the status of the first new task (new tasks are usually 'todo')
      const newTask = tasks.find(t => newTaskIds.includes(t.id));
      if (newTask) {
        setScrollToColumn(newTask.status as Status);
      }
    }

    prevTaskIdsRef.current = currentIds;
  }, [tasks]);

  const handleScrollComplete = useCallback(() => {
    setScrollToColumn(null);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
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
      <div className="h-full flex flex-col overflow-hidden">
        {/* Mobile: snap scroll, Desktop: normal scroll */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x-mandatory sm:snap-none scrollbar-hide sm:scrollbar-thin">
          <div className="flex gap-3 sm:gap-4 pb-4 h-full px-1">
            {(Object.keys(tasksByStatus) as Status[]).map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasksByStatus[status]}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                scrollToBottom={scrollToColumn === status}
                onScrollComplete={handleScrollComplete}
              />
            ))}
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} className="shadow-lg rotate-3" />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
