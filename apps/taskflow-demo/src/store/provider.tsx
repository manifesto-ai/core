'use client';

/**
 * Tasks Store Provider
 *
 * Provides the Zustand store and Manifesto runtime to React components.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTasksStore, tasksRuntime, tasksBridge } from './useTasksStore';
import type { Task } from '../domain/tasks';

// Sample tasks for initial data
const sampleTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Set up project structure',
    description: 'Initialize Next.js app with shadcn/ui',
    status: 'done',
    priority: 'high',
    tags: ['setup', 'infrastructure'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-2',
    title: 'Implement Kanban board',
    description: 'Create drag and drop Kanban view',
    status: 'in-progress',
    priority: 'high',
    tags: ['feature', 'ui'],
    assignee: 'Developer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-3',
    title: 'Add task filtering',
    description: 'Filter tasks by status and priority',
    status: 'todo',
    priority: 'medium',
    tags: ['feature'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-4',
    title: 'Write documentation',
    description: 'Document the SPEC issues found',
    status: 'review',
    priority: 'medium',
    tags: ['docs'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-5',
    title: 'Add AI agent integration',
    description: 'Integrate @manifesto-ai/agent for task assistance',
    status: 'todo',
    priority: 'low',
    tags: ['feature', 'ai'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Context for derived values
interface TasksDerivedContext {
  totalCount: number;
  todoCount: number;
  inProgressCount: number;
  reviewCount: number;
  doneCount: number;
  filteredTasks: Task[];
  todoTasks: Task[];
  inProgressTasks: Task[];
  reviewTasks: Task[];
  doneTasks: Task[];
  selectedTask: Task | null;
  hasSelection: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

const TasksDerivedContext = createContext<TasksDerivedContext | null>(null);

export function useTasksDerived() {
  const context = useContext(TasksDerivedContext);
  if (!context) {
    throw new Error('useTasksDerived must be used within TasksProvider');
  }
  return context;
}

interface TasksProviderProps {
  children: ReactNode;
}

export function TasksProvider({ children }: TasksProviderProps) {
  const [derived, setDerived] = useState<TasksDerivedContext>({
    totalCount: 0,
    todoCount: 0,
    inProgressCount: 0,
    reviewCount: 0,
    doneCount: 0,
    filteredTasks: [],
    todoTasks: [],
    inProgressTasks: [],
    reviewTasks: [],
    doneTasks: [],
    selectedTask: null,
    hasSelection: false,
    canCreate: true,
    canEdit: false,
    canDelete: false,
  });

  // Initialize with sample data
  useEffect(() => {
    const store = useTasksStore.getState();
    if (store.tasks.length === 0) {
      store.setTasks(sampleTasks);
    }
  }, []);

  // Subscribe to runtime changes and compute derived values
  useEffect(() => {
    const updateDerived = () => {
      try {
        setDerived({
          totalCount: tasksRuntime.get('derived.totalCount') as number ?? 0,
          todoCount: tasksRuntime.get('derived.todoCount') as number ?? 0,
          inProgressCount: tasksRuntime.get('derived.inProgressCount') as number ?? 0,
          reviewCount: tasksRuntime.get('derived.reviewCount') as number ?? 0,
          doneCount: tasksRuntime.get('derived.doneCount') as number ?? 0,
          filteredTasks: tasksRuntime.get('derived.filteredTasks') as Task[] ?? [],
          todoTasks: tasksRuntime.get('derived.todoTasks') as Task[] ?? [],
          inProgressTasks: tasksRuntime.get('derived.inProgressTasks') as Task[] ?? [],
          reviewTasks: tasksRuntime.get('derived.reviewTasks') as Task[] ?? [],
          doneTasks: tasksRuntime.get('derived.doneTasks') as Task[] ?? [],
          selectedTask: tasksRuntime.get('derived.selectedTask') as Task | null ?? null,
          hasSelection: tasksRuntime.get('derived.hasSelection') as boolean ?? false,
          canCreate: tasksRuntime.get('derived.canCreate') as boolean ?? true,
          canEdit: tasksRuntime.get('derived.canEdit') as boolean ?? false,
          canDelete: tasksRuntime.get('derived.canDelete') as boolean ?? false,
        });
      } catch (error) {
        console.error('Error computing derived values:', error);
      }
    };

    // Initial update
    updateDerived();

    // Subscribe to store changes
    const unsubscribe = useTasksStore.subscribe(updateDerived);

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <TasksDerivedContext.Provider value={derived}>
      {children}
    </TasksDerivedContext.Provider>
  );
}
