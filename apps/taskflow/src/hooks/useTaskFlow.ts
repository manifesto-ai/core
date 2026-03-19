'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createManifesto } from '@manifesto-ai/sdk';
import type { ManifestoInstance, Snapshot } from '@manifesto-ai/sdk';
import type { Task, TaskStatus, ViewMode } from '@/types/taskflow';
import { TASKFLOW_MEL } from '@/domain/taskflow-schema';
import { TASK_FIXTURES } from '@/lib/taskflow-fixtures';

type TaskFlowState = {
  // Data
  tasks: Task[];
  selectedTaskId: string | null;
  viewMode: ViewMode;
  assistantOpen: boolean;
  // Computed
  activeTasks: Task[];
  deletedTasks: Task[];
  todoTasks: Task[];
  inProgressTasks: Task[];
  reviewTasks: Task[];
  doneTasks: Task[];
  totalCount: number;
  todoCount: number;
  inProgressCount: number;
  reviewCount: number;
  doneCount: number;
  deletedCount: number;
};

type TaskFlowActions = {
  createTask: (task: Task) => void;
  updateTask: (id: string, fields: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  moveTask: (taskId: string, newStatus: TaskStatus) => void;
  softDeleteTask: (id: string) => void;
  restoreTask: (id: string) => void;
  permanentlyDeleteTask: (id: string) => void;
  emptyTrash: () => void;
  selectTask: (taskId: string | null) => void;
  changeView: (mode: ViewMode) => void;
  toggleAssistant: (open: boolean) => void;
};

export type UseTaskFlowResult = {
  state: TaskFlowState | null;
  ready: boolean;
  actions: TaskFlowActions;
  dispatch: (type: string, input?: Record<string, unknown>) => void;
};

function extractState(snapshot: Snapshot): TaskFlowState {
  const d = snapshot.data as Record<string, unknown>;
  const c = snapshot.computed as Record<string, unknown>;
  return {
    tasks: d.tasks as Task[],
    selectedTaskId: d.selectedTaskId as string | null,
    viewMode: d.viewMode as ViewMode,
    assistantOpen: d.assistantOpen as boolean,
    activeTasks: c.activeTasks as Task[],
    deletedTasks: c.deletedTasks as Task[],
    todoTasks: c.todoTasks as Task[],
    inProgressTasks: c.inProgressTasks as Task[],
    reviewTasks: c.reviewTasks as Task[],
    doneTasks: c.doneTasks as Task[],
    totalCount: c.totalCount as number,
    todoCount: c.todoCount as number,
    inProgressCount: c.inProgressCount as number,
    reviewCount: c.reviewCount as number,
    doneCount: c.doneCount as number,
    deletedCount: c.deletedCount as number,
  };
}

export function useTaskFlow(): UseTaskFlowResult {
  const instanceRef = useRef<ManifestoInstance | null>(null);
  const [state, setState] = useState<TaskFlowState | null>(null);

  useEffect(() => {
    const instance = createManifesto({
      schema: TASKFLOW_MEL,
      effects: {},
    });
    instanceRef.current = instance;

    // Seed fixture data
    for (const task of TASK_FIXTURES) {
      instance.dispatch({
        type: 'createTask',
        input: { task },
        intentId: crypto.randomUUID(),
      });
    }

    // Set initial state after seeding
    setState(extractState(instance.getSnapshot()));

    const unsubscribe = instance.subscribe(
      (s) => s,
      (snapshot) => {
        setState(extractState(snapshot));
      },
    );

    return () => {
      unsubscribe();
      instanceRef.current = null;
      instance.dispose();
    };
  }, []);

  const dispatch = useCallback((type: string, input?: Record<string, unknown>) => {
    instanceRef.current?.dispatch({
      type,
      input,
      intentId: crypto.randomUUID(),
    });
  }, []);

  const actions: TaskFlowActions = {
    createTask: useCallback((task: Task) => {
      dispatch('createTask', { task });
    }, [dispatch]),

    updateTask: useCallback((id: string, fields: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
      dispatch('updateTask', {
        id,
        title: fields.title ?? null,
        description: fields.description ?? null,
        status: fields.status ?? null,
        priority: fields.priority ?? null,
        assignee: fields.assignee ?? null,
        dueDate: fields.dueDate ?? null,
        tags: fields.tags ?? null,
        updatedAt: new Date().toISOString(),
      });
    }, [dispatch]),

    moveTask: useCallback((taskId: string, newStatus: TaskStatus) => {
      dispatch('moveTask', { taskId, newStatus });
    }, [dispatch]),

    softDeleteTask: useCallback((id: string) => {
      dispatch('softDeleteTask', { id, timestamp: new Date().toISOString() });
    }, [dispatch]),

    restoreTask: useCallback((id: string) => {
      dispatch('restoreTask', { id });
    }, [dispatch]),

    permanentlyDeleteTask: useCallback((id: string) => {
      dispatch('permanentlyDeleteTask', { id });
    }, [dispatch]),

    emptyTrash: useCallback(() => {
      dispatch('emptyTrash', {});
    }, [dispatch]),

    selectTask: useCallback((taskId: string | null) => {
      dispatch('selectTask', { taskId });
    }, [dispatch]),

    changeView: useCallback((mode: ViewMode) => {
      dispatch('changeView', { mode });
    }, [dispatch]),

    toggleAssistant: useCallback((open: boolean) => {
      dispatch('toggleAssistant', { open });
    }, [dispatch]),
  };

  return { state, ready: state !== null, actions, dispatch };
}
