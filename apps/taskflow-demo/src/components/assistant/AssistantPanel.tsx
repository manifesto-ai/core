'use client';

import { useState, useCallback } from 'react';
import { AssistantHeader } from './AssistantHeader';
import { AssistantMessages } from './AssistantMessages';
import { AssistantInput } from './AssistantInput';
import { QuickActions } from './messages';
import { useTasksStore } from '@/store/useTasksStore';
import type { DateFilter } from '@/components/ui/date-range-picker';
import type {
  AssistantMessage,
  UserMessage as UserMessageType,
  TaskCreatedMessage,
  TaskListMessage,
  TextMessage as TextMessageType,
  ErrorMessage,
} from '@/types/assistant';
import { generateMessageId as genId } from '@/types/assistant';
import type { Task } from '@/domain/tasks';

interface AssistantPanelProps {
  onClose: () => void;
}

interface AgentResponse {
  message?: string;
  effects: Array<{
    type: string;
    id: string;
    ops?: Array<{
      op: string;
      path: string;
      value: unknown;
    }>;
  }>;
  error?: string;
}

export function AssistantPanel({ onClose }: AssistantPanelProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const tasks = useTasksStore((s) => s.tasks);
  const viewMode = useTasksStore((s) => s.viewMode);
  const dateFilter = useTasksStore((s) => s.dateFilter);
  const addTask = useTasksStore((s) => s.addTask);
  const updateTask = useTasksStore((s) => s.updateTask);
  const removeTask = useTasksStore((s) => s.removeTask);
  const restoreTask = useTasksStore((s) => s.restoreTask);
  const setViewMode = useTasksStore((s) => s.setViewMode);
  const setDateFilter = useTasksStore((s) => s.setDateFilter);
  const setSelectedTaskId = useTasksStore((s) => s.setSelectedTaskId);

  const handleSubmit = useCallback(async (content: string) => {
    // 사용자 메시지 추가
    const userMessage: UserMessageType = {
      id: genId(),
      type: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);

    try {
      // API 직접 호출
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot: {
            data: { tasks },
            state: { selectedTaskId: null, viewMode, dateFilter },
          },
          instruction: content,
        }),
      });

      const data: AgentResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Effects 적용 및 생성된 Task 수집
      const createdTasks: Task[] = [];
      const updatedTasks: { task: Task; changes: Partial<Task> }[] = [];

      for (const effect of data.effects) {
        if (effect.type === 'snapshot.patch' && effect.ops) {
          for (const op of effect.ops) {
            if (op.op === 'append' && op.path === 'data.tasks' && op.value) {
              // Task 추가
              const newTask = op.value as Task;
              addTask(newTask);
              createdTasks.push(newTask);
            } else if (op.op === 'set' && op.path === 'state.viewMode') {
              // View 모드 변경
              const mode = op.value as 'todo' | 'kanban' | 'table';
              setViewMode(mode);
            } else if (op.op === 'set' && op.path === 'state.dateFilter') {
              // Date 필터 변경
              setDateFilter(op.value as DateFilter | null);
            } else if (op.op === 'set' && op.path === 'state.selectedTaskId') {
              // Task 선택 (상세 패널 열기/닫기)
              setSelectedTaskId(op.value as string | null);
            } else if (op.op === 'remove' && op.path === 'data.tasks') {
              // Task 삭제 (soft delete)
              const taskId = op.value as string;
              removeTask(taskId);
              // 삭제된 task가 선택되어 있었다면 선택 해제
              if (useTasksStore.getState().selectedTaskId === taskId) {
                setSelectedTaskId(null);
              }
            } else if (op.op === 'restore' && op.path === 'data.tasks') {
              // Task 복구
              const taskId = op.value as string;
              restoreTask(taskId);
            } else if (op.op === 'set' && op.path.startsWith('data.tasks.')) {
              // Task 업데이트
              const match = op.path.match(/data\.tasks\.(\d+)\.(\w+)/);
              if (match) {
                const [, indexStr, field] = match;
                const index = parseInt(indexStr, 10);
                const task = tasks[index];
                if (task) {
                  const changes = { [field]: op.value } as Partial<Task>;
                  updateTask(task.id, changes);
                  updatedTasks.push({ task: { ...task, ...changes }, changes });
                }
              }
            }
          }
        }
      }

      // 응답 메시지 생성
      let responseMessage: AssistantMessage;

      if (createdTasks.length > 1) {
        // 여러 Task 생성됨
        const taskListMsg: TaskListMessage = {
          id: genId(),
          type: 'task-list',
          tasks: createdTasks,
          summary: data.message || `${createdTasks.length} tasks created`,
          timestamp: new Date(),
        };
        responseMessage = taskListMsg;
      } else if (createdTasks.length === 1) {
        // 단일 Task 생성
        const taskCreatedMsg: TaskCreatedMessage = {
          id: genId(),
          type: 'task-created',
          task: createdTasks[0],
          summary: data.message || `${createdTasks[0].priority} priority task created`,
          timestamp: new Date(),
        };
        responseMessage = taskCreatedMsg;
      } else if (updatedTasks.length > 0) {
        // Task 업데이트
        const textMsg: TextMessageType = {
          id: genId(),
          type: 'text',
          content: data.message || `${updatedTasks.length} tasks updated`,
          timestamp: new Date(),
        };
        responseMessage = textMsg;
      } else {
        // 일반 텍스트 응답 (질문에 대한 답변 등)
        const textMsg: TextMessageType = {
          id: genId(),
          type: 'text',
          content: data.message || 'Done.',
          timestamp: new Date(),
        };
        responseMessage = textMsg;
      }

      setMessages((prev) => [...prev, responseMessage]);
    } catch (error) {
      const errorMsg: ErrorMessage = {
        id: genId(),
        type: 'error',
        content: error instanceof Error ? error.message : 'An unknown error occurred',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  }, [tasks, viewMode, dateFilter, addTask, updateTask, removeTask, restoreTask, setViewMode, setDateFilter, setSelectedTaskId]);

  const handleViewTask = useCallback((taskId: string) => {
    useTasksStore.getState().setSelectedTaskId(taskId);
  }, []);

  const handleEditTask = useCallback((taskId: string) => {
    useTasksStore.getState().setSelectedTaskId(taskId);
    useTasksStore.getState().setIsEditing(true);
  }, []);

  const handleNewTask = useCallback(() => {
    handleSubmit('Create a new task');
  }, [handleSubmit]);

  return (
    <div className="flex flex-col h-full bg-background">
      <AssistantHeader onClose={onClose} />

      <AssistantMessages
        messages={messages}
        isThinking={isThinking}
        onViewTask={handleViewTask}
        onEditTask={handleEditTask}
        onSelectTask={handleViewTask}
      />

      {/* Quick actions (only when no messages) */}
      {messages.length === 0 && !isThinking && (
        <div className="px-4 pb-2">
          <QuickActions
            onNewTask={handleNewTask}
            onShowAll={() => handleSubmit('Show all tasks')}
            onTodayTasks={() => handleSubmit('Show tasks due today')}
            onWeekTasks={() => handleSubmit('Show tasks due this week')}
          />
        </div>
      )}

      <AssistantInput
        onSubmit={handleSubmit}
        isLoading={isThinking}
      />
    </div>
  );
}
