/**
 * Assistant Panel 타입 정의
 */

import type { Task } from '@/manifesto';
import type { AgentStep } from '@/lib/agents/types';

/**
 * 메시지 타입
 */
export type AssistantMessageType =
  | 'user'           // 사용자 입력
  | 'text'           // 일반 텍스트 응답
  | 'task-created'   // Task 생성 결과
  | 'task-updated'   // Task 수정 결과
  | 'task-deleted'   // Task 삭제 결과
  | 'task-list'      // 여러 Task 표시
  | 'agent-execution' // 에이전트 실행 결과
  | 'error'          // 에러
  | 'thinking';      // 로딩 중

/**
 * 기본 메시지 인터페이스
 */
interface BaseMessage {
  id: string;
  timestamp: Date;
}

/**
 * 사용자 메시지
 */
export interface UserMessage extends BaseMessage {
  type: 'user';
  content: string;
}

/**
 * 텍스트 응답
 */
export interface TextMessage extends BaseMessage {
  type: 'text';
  content: string;
}

/**
 * Task 생성 결과
 */
export interface TaskCreatedMessage extends BaseMessage {
  type: 'task-created';
  task: Task;
  summary: string;
}

/**
 * Task 수정 결과
 */
export interface TaskUpdatedMessage extends BaseMessage {
  type: 'task-updated';
  task: Task;
  changes: Partial<Task>;
  summary: string;
}

/**
 * Task 삭제 결과
 */
export interface TaskDeletedMessage extends BaseMessage {
  type: 'task-deleted';
  taskId: string;
  taskTitle: string;
  summary: string;
}

/**
 * Task 리스트
 */
export interface TaskListMessage extends BaseMessage {
  type: 'task-list';
  tasks: Task[];
  summary: string;
}

/**
 * 에러 메시지
 */
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  content: string;
}

/**
 * 로딩 메시지
 */
export interface ThinkingMessage extends BaseMessage {
  type: 'thinking';
}

/**
 * 에이전트 실행 메시지 (타임라인 UI)
 */
export interface AgentExecutionMessage extends BaseMessage {
  type: 'agent-execution';
  steps: AgentStep[];
  summary: string;
  status: 'running' | 'completed' | 'failed';
  /** Skip text animation (for restored messages) */
  skipAnimation?: boolean;
}

/**
 * 모든 메시지 타입 유니온
 */
export type AssistantMessage =
  | UserMessage
  | TextMessage
  | TaskCreatedMessage
  | TaskUpdatedMessage
  | TaskDeletedMessage
  | TaskListMessage
  | AgentExecutionMessage
  | ErrorMessage
  | ThinkingMessage;

/**
 * 메시지 ID 생성
 */
export function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * API 응답의 message 필드 타입
 */
export interface AgentResponseMessage {
  type: 'task-created' | 'task-updated' | 'task-deleted' | 'task-list' | 'text';
  task?: Task;
  tasks?: Task[];
  changes?: Partial<Task>;
  summary: string;
}
