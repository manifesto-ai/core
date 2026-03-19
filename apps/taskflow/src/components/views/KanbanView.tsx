'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { TaskCard } from '@/components/shared/TaskCard';
import { cn } from '@/lib/utils';
import type { Task, TaskStatus } from '@/types/taskflow';

type StatusColumn = {
  status: TaskStatus;
  label: string;
  tone: string;
};

const COLUMNS: StatusColumn[] = [
  {
    status: 'todo',
    label: 'To Do',
    tone: 'bg-secondary text-secondary-foreground',
  },
  {
    status: 'in-progress',
    label: 'In Progress',
    tone: 'bg-primary/10 text-primary',
  },
  {
    status: 'review',
    label: 'Review',
    tone: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  {
    status: 'done',
    label: 'Done',
    tone: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
];

interface KanbanViewProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onMoveTask?: (taskId: string, status: TaskStatus) => void;
}

interface SortableTaskProps {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
}

function SortableTask({ task, isSelected, onSelect }: SortableTaskProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} isSelected={isSelected} onSelect={onSelect} />
    </div>
  );
}

function DroppableColumn({ status, children }: { status: TaskStatus; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: `column:${status}` });
  return (
    <div ref={setNodeRef} className="flex-1 space-y-2 rounded-b-lg bg-muted/50 p-2 min-h-[80px]">
      {children}
    </div>
  );
}

export function KanbanView({
  tasks,
  selectedTaskId,
  onSelectTask,
  onMoveTask,
}: KanbanViewProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const groupedTasks = COLUMNS.map((column) => ({
    ...column,
    tasks: tasks.filter((task) => task.status === column.status),
  }));

  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);

    if (!onMoveTask || !event.over) {
      return;
    }

    const draggedTask = tasks.find((task) => task.id === event.active.id);
    if (!draggedTask) return;

    const overId = String(event.over.id);

    // Check if dropped on a column droppable (id = "column:<status>")
    if (overId.startsWith('column:')) {
      const targetStatus = overId.replace('column:', '') as TaskStatus;
      if (draggedTask.status !== targetStatus) {
        onMoveTask(draggedTask.id, targetStatus);
      }
      return;
    }

    // Dropped on another task — use that task's status
    const targetTask = tasks.find((task) => task.id === overId);
    if (targetTask && draggedTask.status !== targetTask.status) {
      onMoveTask(draggedTask.id, targetTask.status);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto pb-4 snap-x sm:snap-none">
        {groupedTasks.map((column) => (
          <section
            key={column.status}
            className="flex w-[85vw] flex-shrink-0 snap-center flex-col sm:w-auto sm:min-w-[280px] sm:flex-1 sm:max-w-[320px]"
          >
            <div className={cn('rounded-t-lg p-3', column.tone)}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{column.label}</h3>
                <Badge variant="secondary">{column.tasks.length}</Badge>
              </div>
            </div>
            <DroppableColumn status={column.status}>
              <SortableContext
                items={column.tasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
              >
                {column.tasks.map((task) => (
                  <SortableTask
                    key={task.id}
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onSelect={() => onSelectTask(task.id)}
                  />
                ))}
              </SortableContext>
              {column.tasks.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Drop tasks here
                </div>
              )}
            </DroppableColumn>
          </section>
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="w-[280px]">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
