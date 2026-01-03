/**
 * Stage 3: Build Context
 *
 * LLM 호출에 필요한 컨텍스트 구성
 */

import { Result, Ok } from '../result';
import { SimpleAgentError, SimpleAgentInput, LLMContext } from '../types';
import { createSystemPrompt } from '../prompts';

/**
 * LLM 호출을 위한 컨텍스트 구성
 *
 * @param input - 파싱된 요청 입력
 * @returns Result<LLMContext, SimpleAgentError>
 */
export function buildContext(
  input: SimpleAgentInput
): Result<LLMContext, SimpleAgentError> {
  const { instruction, snapshot } = input;

  // 활성 태스크만 추출
  const activeTasks = snapshot.data.tasks.filter(t => !t.deletedAt);

  // LLM에 전달할 태스크 목록 (필요한 필드만)
  const taskListForLLM = activeTasks.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
  }));

  // 현재 선택된 태스크
  const selectedTask = snapshot.state.selectedTaskId
    ? activeTasks.find(t => t.id === snapshot.state.selectedTaskId)
    : null;

  // 사용자 메시지 구성
  const userMessage = `## Current Tasks
${JSON.stringify(taskListForLLM, null, 2)}

## Currently Selected Task
${
  selectedTask
    ? `ID: ${selectedTask.id}
Title: "${selectedTask.title}"
Status: ${selectedTask.status}
Priority: ${selectedTask.priority}`
    : 'None (no task is currently selected)'
}

## Current View State
- View Mode: ${snapshot.state.viewMode}
- Date Filter: ${snapshot.state.dateFilter ? JSON.stringify(snapshot.state.dateFilter) : 'none'}

## User Instruction
${instruction}

Output only a valid JSON Intent object.`;

  return Ok({
    input,
    systemPrompt: createSystemPrompt(),
    userMessage,
  });
}
