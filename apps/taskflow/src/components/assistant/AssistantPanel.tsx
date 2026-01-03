'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AssistantHeader } from './AssistantHeader';
import { AssistantMessages } from './AssistantMessages';
import { AssistantInput } from './AssistantInput';
import { QuickActions, ConfirmPrompt } from './messages';
import { useTasks, useTasksState, useUIStore } from '@/store/useTasksStore';
import type { DateFilter } from '@/components/ui/date-range-picker';
import type {
  AssistantMessage,
  UserMessage as UserMessageType,
  AgentExecutionMessage,
  ErrorMessage,
} from '@/types/assistant';
import { generateMessageId as genId } from '@/types/assistant';
import type { Task } from '@/manifesto';
import type { AgentStep, AgentEffect } from '@/lib/agents/types';
import type { ChatMessage } from '@/lib/storage/types';

interface AssistantPanelProps {
  onClose: () => void;
}

// Parse step from serialized JSON (outside component to avoid recreation)
function parseStep(step: Record<string, unknown>): AgentStep {
  return {
    id: step.id as string,
    agentName: step.agentName as string,
    agentIcon: step.agentIcon as string,
    status: step.status as AgentStep['status'],
    description: step.description as string | undefined,
    input: step.input as Record<string, unknown> | undefined,
    output: step.output as Record<string, unknown> | undefined,
    error: step.error as string | undefined,
    startTime: new Date(step.startTime as string),
    endTime: step.endTime ? new Date(step.endTime as string) : undefined,
    duration: step.duration as number | undefined,
  };
}

export function AssistantPanel({ onClose }: AssistantPanelProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const executionMsgIdRef = useRef<string | null>(null);
  const saveToHistoryRef = useRef<(role: 'user' | 'assistant', content: string) => void>(() => {});
  const [clarificationSessionId, setClarificationSessionId] = useState<string | null>(null);
  const [confirmSessionId, setConfirmSessionId] = useState<string | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  // Get state and actions from Manifesto provider
  const tasksContext = useTasks();
  const tasksState = useTasksState();

  // Domain state from Manifesto
  const tasks = tasksState?.tasks ?? [];
  const viewMode = tasksState?.viewMode ?? 'kanban';
  const selectedTaskId = tasksState?.selectedTaskId ?? null;

  // Domain actions from Manifesto (these actually work!)
  const createTaskAction = tasksContext.createTask;
  const updateTaskAction = tasksContext.updateTask;
  const deleteTaskAction = tasksContext.deleteTask;
  const restoreTaskAction = tasksContext.restoreTask;
  const changeViewAction = tasksContext.changeView;
  const selectTaskAction = tasksContext.selectTask;

  // UI-only state from local store
  const dateFilter = useUIStore((s) => s.dateFilter);
  const setDateFilter = useUIStore((s) => s.setDateFilter);
  const setAssistantOpen = useUIStore((s) => s.setAssistantOpen);
  const lastCreatedTaskIds = useUIStore((s) => s.lastCreatedTaskIds);
  const setLastCreatedTaskIds = useUIStore((s) => s.setLastCreatedTaskIds);
  const lastModifiedTaskId = useUIStore((s) => s.lastModifiedTaskId);
  const setLastModifiedTaskId = useUIStore((s) => s.setLastModifiedTaskId);
  const chatHistory = useUIStore((s) => s.chatHistory);
  const addChatMessage = useUIStore((s) => s.addChatMessage);
  const clearChatHistory = useUIStore((s) => s.clearChatHistory);

  // Initialize messages from stored chat history
  useEffect(() => {
    if (chatHistory.length > 0 && messages.length === 0) {
      const restored: AssistantMessage[] = chatHistory.map((msg) => {
        if (msg.role === 'user') {
          return {
            id: msg.id,
            type: 'user' as const,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
          };
        } else {
          // Restore assistant messages as completed agent-execution
          return {
            id: msg.id,
            type: 'agent-execution' as const,
            steps: [],
            summary: msg.content,
            status: 'completed' as const,
            timestamp: new Date(msg.timestamp),
            skipAnimation: true, // Skip text effect for restored messages
          };
        }
      });
      setMessages(restored);
    }
  }, [chatHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper to save message to storage
  const saveToHistory = useCallback((role: 'user' | 'assistant', content: string) => {
    const chatMsg: ChatMessage = {
      id: genId(),
      role,
      content,
      timestamp: new Date().toISOString(),
    };
    addChatMessage(chatMsg);
  }, [addChatMessage]);

  // Keep ref updated for use in callbacks
  useEffect(() => {
    saveToHistoryRef.current = saveToHistory;
  }, [saveToHistory]);

  // Helper to update agent execution message
  const updateExecutionMessage = useCallback((
    msgId: string,
    updater: (msg: AgentExecutionMessage) => AgentExecutionMessage
  ) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === msgId && msg.type === 'agent-execution'
          ? updater(msg as AgentExecutionMessage)
          : msg
      )
    );
  }, []);

  // Effects를 적용하는 헬퍼 함수
  const applyEffects = useCallback(async (effects: AgentEffect[]) => {
    console.log('[AssistantPanel] ========== APPLYING EFFECTS ==========');
    console.log('[AssistantPanel] Effects received:', effects.length);
    console.log('[AssistantPanel] Effects detail:', JSON.stringify(effects, null, 2));

    const createdTaskIds: string[] = [];
    let modifiedTaskId: string | null = null;

    for (const effect of effects) {
      console.log('[AssistantPanel] Processing effect:', effect.type);
      if (effect.type === 'snapshot.patch' && effect.ops) {
        console.log('[AssistantPanel] Ops count:', effect.ops.length);
        for (const op of effect.ops) {
          console.log('[AssistantPanel] Processing op:', op.op, op.path);
          if (op.op === 'append' && op.path === 'data.tasks') {
            const task = op.value as Task;
            console.log('[AssistantPanel] Adding task via Manifesto:', task.id, task.title);
            try {
              // Use Manifesto action to create task
              await createTaskAction({
                title: task.title,
                description: task.description,
                priority: task.priority,
                dueDate: task.dueDate,
                tags: task.tags,
              });
              console.log('[AssistantPanel] Task created successfully');
              createdTaskIds.push(task.id);
            } catch (createErr) {
              console.error('[AssistantPanel] Failed to create task:', createErr);
            }
          } else if (op.op === 'set' && op.path === 'state.viewMode') {
            console.log('[AssistantPanel] Changing view mode:', op.value);
            await changeViewAction(op.value as 'todo' | 'kanban' | 'table');
          } else if (op.op === 'set' && op.path === 'state.dateFilter') {
            setDateFilter(op.value as DateFilter | null);
          } else if (op.op === 'set' && op.path === 'state.selectedTaskId') {
            console.log('[AssistantPanel] Selecting task:', op.value);
            await selectTaskAction(op.value as string | null);
          } else if (op.op === 'set' && op.path === 'state.assistantOpen') {
            setAssistantOpen(op.value as boolean);
          } else if (op.op === 'remove' && op.path === 'data.tasks') {
            const taskId = op.value as string;
            console.log('[AssistantPanel] Deleting task:', taskId);
            await deleteTaskAction(taskId);
            if (selectedTaskId === taskId) {
              await selectTaskAction(null);
            }
          } else if (op.op === 'restore' && op.path === 'data.tasks') {
            console.log('[AssistantPanel] Restoring task:', op.value);
            await restoreTaskAction(op.value as string);
          } else if (op.op === 'set' && op.path.startsWith('data.tasks.')) {
            // Handle new format: data.tasks.id:taskId.field
            const idMatch = op.path.match(/data\.tasks\.id:([^.]+)\.(\w+)/);
            if (idMatch) {
              const [, taskId, field] = idMatch;
              console.log('[AssistantPanel] Updating task field:', taskId, field, op.value);
              // For status changes, use moveTask
              if (field === 'status') {
                await tasksContext.moveTask(taskId, op.value as "todo" | "in-progress" | "review" | "done");
              } else {
                await updateTaskAction({
                  id: taskId,
                  [field]: op.value,
                });
              }
              modifiedTaskId = taskId;
            } else {
              // Handle legacy format: data.tasks.index.field
              const indexMatch = op.path.match(/data\.tasks\.(\d+)\.(\w+)/);
              if (indexMatch) {
                const [, indexStr, field] = indexMatch;
                const index = parseInt(indexStr, 10);
                const task = tasks[index];
                if (task) {
                  console.log('[AssistantPanel] Updating task (legacy format):', task.id, field, op.value);
                  if (field === 'status') {
                    await tasksContext.moveTask(task.id, op.value as "todo" | "in-progress" | "review" | "done");
                  } else {
                    await updateTaskAction({
                      id: task.id,
                      [field]: op.value,
                    });
                  }
                  modifiedTaskId = task.id;
                }
              }
            }
          }
        }
      }
    }

    // Update last action context
    if (createdTaskIds.length > 0) {
      console.log('[AssistantPanel] Created task IDs:', createdTaskIds);
      setLastCreatedTaskIds(createdTaskIds);
    }
    if (modifiedTaskId) {
      console.log('[AssistantPanel] Modified task ID:', modifiedTaskId);
      setLastModifiedTaskId(modifiedTaskId);
    }
    console.log('[AssistantPanel] ========== EFFECTS APPLIED ==========');
  }, [createTaskAction, updateTaskAction, deleteTaskAction, restoreTaskAction, changeViewAction, selectTaskAction, tasksContext, tasks, selectedTaskId, setDateFilter, setAssistantOpen, setLastCreatedTaskIds, setLastModifiedTaskId]);

  // SSE 이벤트 처리 (Simple API)
  const handleSSEEvent = useCallback((msgId: string, eventType: string, data: unknown) => {
    const payload = data as Record<string, unknown>;
    console.log('[AssistantPanel] SSE Event:', eventType, payload);

    switch (eventType) {
      case 'start': {
        const step: AgentStep = {
          id: 'processing',
          agentName: 'processing',
          agentIcon: '🧠',
          status: 'running',
          description: 'Processing...',
          startTime: new Date(),
        };
        updateExecutionMessage(msgId, (msg) => ({
          ...msg,
          steps: [step],
        }));
        break;
      }

      case 'intent': {
        updateExecutionMessage(msgId, (msg) => ({
          ...msg,
          steps: msg.steps.map((s) =>
            s.id === 'processing'
              ? { ...s, status: 'completed' as const, description: 'Understood', endTime: new Date() }
              : s
          ).concat({
            id: 'executing',
            agentName: 'executing',
            agentIcon: '⚡',
            status: 'running',
            description: 'Executing...',
            startTime: new Date(),
          }),
        }));
        break;
      }

      case 'done': {
        const message = payload.message as string;
        const effects = payload.effects as AgentEffect[];

        if (effects && effects.length > 0) {
          // Apply effects asynchronously with error handling
          applyEffects(effects).catch((err) => {
            console.error('[AssistantPanel] Error applying effects:', err);
          });
        }

        updateExecutionMessage(msgId, (msg) => ({
          ...msg,
          steps: msg.steps.map((s) =>
            s.id === 'executing'
              ? { ...s, status: 'completed' as const, description: 'Done', endTime: new Date() }
              : s
          ),
          summary: message || 'Done.',
          status: 'completed',
        }));

        // Save assistant response to history
        if (message) {
          saveToHistoryRef.current('assistant', message);
        }
        break;
      }

      case 'error': {
        const errorMessage = payload.error as string;
        updateExecutionMessage(msgId, (msg) => ({
          ...msg,
          steps: msg.steps.map((s) =>
            s.status === 'running'
              ? { ...s, status: 'failed' as const, error: errorMessage, endTime: new Date() }
              : s
          ),
          summary: `Error: ${errorMessage}`,
          status: 'failed',
        }));
        break;
      }
    }
  }, [updateExecutionMessage, applyEffects]);

  // 메시지 제출 핸들러
  const handleSubmit = useCallback(async (content: string) => {
    const userMessage: UserMessageType = {
      id: genId(),
      type: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    saveToHistory('user', content);
    setIsThinking(true);

    const execMsgId = genId();
    executionMsgIdRef.current = execMsgId;
    const initialExecMsg: AgentExecutionMessage = {
      id: execMsgId,
      type: 'agent-execution',
      steps: [],
      summary: '',
      status: 'running',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, initialExecMsg]);

    try {
      // Build request body
      const requestBody: Record<string, unknown> = {
        instruction: content,
        snapshot: {
          data: { tasks },
          state: {
            selectedTaskId,
            viewMode,
            dateFilter,
            lastCreatedTaskIds,
            lastModifiedTaskId,
          },
        },
      };

      // Include sessionId if in clarification follow-up mode
      if (clarificationSessionId) {
        requestBody.sessionId = clarificationSessionId;
      }

      const response = await fetch('/api/agent/simple/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to connect to stream');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7);
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6);

            if (eventType && eventData) {
              try {
                const data = JSON.parse(eventData);
                handleSSEEvent(execMsgId, eventType, data);
              } catch {
                // Ignore parse errors
              }
              eventType = '';
              eventData = '';
            }
          }
        }
      }
    } catch (error) {
      const errorMsg: ErrorMessage = {
        id: genId(),
        type: 'error',
        content: error instanceof Error ? error.message : 'An unknown error occurred',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setMessages((prev) => prev.filter((m) => m.id !== execMsgId));
    } finally {
      setIsThinking(false);
      executionMsgIdRef.current = null;
    }
  }, [tasks, viewMode, dateFilter, selectedTaskId, handleSSEEvent, clarificationSessionId, lastCreatedTaskIds, lastModifiedTaskId, saveToHistory]);

  // Confirm 응답 핸들러
  const handleConfirmResponse = useCallback(async (approved: boolean) => {
    if (!confirmSessionId) return;

    setIsConfirmLoading(true);

    const execMsgId = genId();
    executionMsgIdRef.current = execMsgId;
    const initialExecMsg: AgentExecutionMessage = {
      id: execMsgId,
      type: 'agent-execution',
      steps: [{
        id: 'confirm-response',
        agentName: approved ? 'approving' : 'cancelling',
        agentIcon: approved ? '✅' : '❌',
        status: 'running',
        description: approved ? 'Continuing...' : 'Cancelling...',
        startTime: new Date(),
      }],
      summary: '',
      status: 'running',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, initialExecMsg]);

    try {
      const response = await fetch('/api/agent/simple/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: '',
          snapshot: {
            data: { tasks },
            state: {
              selectedTaskId,
              viewMode,
              dateFilter,
              lastCreatedTaskIds,
              lastModifiedTaskId,
            },
          },
          confirmSessionId,
          approved,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to connect to stream');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7);
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6);

            if (eventType && eventData) {
              try {
                const data = JSON.parse(eventData);
                handleSSEEvent(execMsgId, eventType, data);
              } catch {
                // Ignore parse errors
              }
              eventType = '';
              eventData = '';
            }
          }
        }
      }
    } catch (error) {
      const errorMsg: ErrorMessage = {
        id: genId(),
        type: 'error',
        content: error instanceof Error ? error.message : 'An unknown error occurred',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setMessages((prev) => prev.filter((m) => m.id !== execMsgId));
    } finally {
      setIsConfirmLoading(false);
      setConfirmSessionId(null);
      setConfirmMessage(null);
      executionMsgIdRef.current = null;
    }
  }, [confirmSessionId, tasks, viewMode, dateFilter, selectedTaskId, lastCreatedTaskIds, lastModifiedTaskId, handleSSEEvent]);

  const handleViewTask = useCallback(async (taskId: string) => {
    await selectTaskAction(taskId);
  }, [selectTaskAction]);

  const handleEditTask = useCallback(async (taskId: string) => {
    await selectTaskAction(taskId);
    // Note: isEditing state should be managed through Manifesto
    // For now, we rely on the selection triggering the edit view
  }, [selectTaskAction]);

  const handleNewTask = useCallback(() => {
    handleSubmit('Create a new task');
  }, [handleSubmit]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <AssistantHeader onClose={onClose} />

      <AssistantMessages
        messages={messages}
        isThinking={isThinking}
        onViewTask={handleViewTask}
        onEditTask={handleEditTask}
        onSelectTask={handleViewTask}
      />

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

      {confirmSessionId && confirmMessage && (
        <ConfirmPrompt
          message={confirmMessage}
          sessionId={confirmSessionId}
          onApprove={() => handleConfirmResponse(true)}
          onReject={() => handleConfirmResponse(false)}
          isLoading={isConfirmLoading}
        />
      )}

      <AssistantInput
        onSubmit={handleSubmit}
        isLoading={isThinking}
      />
    </div>
  );
}
