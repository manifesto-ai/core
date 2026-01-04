/**
 * Clarification Session Store
 *
 * 서버 메모리 기반 세션 스토어
 * - Resolver 실패 후속 응답을 위한 컨텍스트 보관
 * - 5분 TTL (Time-To-Live)
 * - 로그인 불필요 (서버 메모리 사용)
 *
 * 새 아키텍처: Clarification은 Resolver 실패에서만 발생
 */

import type { IntentSkeleton, TaskRefSkeleton } from './skeleton';
import type { Snapshot } from './runtime';
import type { ResolverError } from './resolver';
import type { ConfirmPending } from './executor';
import type { Plan } from './plan';

// ============================================
// Session Types
// ============================================

export interface ClarificationSession {
  id: string;
  skeleton: IntentSkeleton;        // 원본 Skeleton (targetHint 포함)
  snapshot: Snapshot;              // 원본 스냅샷
  originalInstruction: string;     // 원본 instruction
  resolverError: ResolverError;    // Resolver 에러 정보
  createdAt: number;
}

export interface CreateSessionInput {
  skeleton: IntentSkeleton;
  snapshot: Snapshot;
  originalInstruction: string;
  resolverError: ResolverError;
}

// ============================================
// Confirm Session Types (PR4)
// ============================================

export interface ConfirmSession {
  id: string;
  type: 'confirm';
  pending: ConfirmPending;
  originalInstruction: string;
  snapshot: Snapshot;
  plan: Plan;
  createdAt: number;
}

export interface CreateConfirmSessionInput {
  pending: ConfirmPending;
  originalInstruction: string;
  snapshot: Snapshot;
  plan: Plan;
}

// Union type for all sessions
export type AgentSession = ClarificationSession | ConfirmSession;

// ============================================
// Session Store
// ============================================

const SESSION_TTL_MS = 5 * 60 * 1000; // 5분

// In-memory stores
const sessions = new Map<string, ClarificationSession>();
const confirmSessions = new Map<string, ConfirmSession>();

/**
 * 새 Clarification 세션 생성 (Resolver 실패 시)
 *
 * @param input - 세션 생성 입력
 * @returns 생성된 세션 ID
 */
export function createClarificationSession(input: CreateSessionInput): string {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    id: sessionId,
    skeleton: input.skeleton,
    snapshot: input.snapshot,
    originalInstruction: input.originalInstruction,
    resolverError: input.resolverError,
    createdAt: Date.now(),
  });
  cleanExpiredSessions();
  return sessionId;
}

/**
 * 세션 조회
 *
 * @param sessionId - 세션 ID
 * @returns 세션 또는 null (만료/없음)
 */
export function getSession(sessionId: string): ClarificationSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // TTL 체크
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * 세션 삭제
 *
 * @param sessionId - 세션 ID
 */
export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * 만료된 세션 정리
 */
function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
  for (const [id, session] of confirmSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      confirmSessions.delete(id);
    }
  }
}

// ============================================
// Confirm Session Functions (PR4)
// ============================================

/**
 * 새 Confirm 세션 생성 (Executor에서 ConfirmPending 반환 시)
 *
 * @param input - 세션 생성 입력
 * @returns 생성된 세션 ID
 */
export function createConfirmSession(input: CreateConfirmSessionInput): string {
  const sessionId = crypto.randomUUID();
  confirmSessions.set(sessionId, {
    id: sessionId,
    type: 'confirm',
    pending: input.pending,
    originalInstruction: input.originalInstruction,
    snapshot: input.snapshot,
    plan: input.plan,
    createdAt: Date.now(),
  });
  cleanExpiredSessions();
  return sessionId;
}

/**
 * Confirm 세션 조회
 *
 * @param sessionId - 세션 ID
 * @returns 세션 또는 null (만료/없음)
 */
export function getConfirmSession(sessionId: string): ConfirmSession | null {
  const session = confirmSessions.get(sessionId);
  if (!session) return null;

  // TTL 체크
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    confirmSessions.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Confirm 세션 삭제
 *
 * @param sessionId - 세션 ID
 */
export function deleteConfirmSession(sessionId: string): void {
  confirmSessions.delete(sessionId);
}

/**
 * Type guard: ConfirmSession 여부 확인
 */
export function isConfirmSession(session: AgentSession): session is ConfirmSession {
  return 'type' in session && session.type === 'confirm';
}

// ============================================
// Clarification Context Builder
// ============================================

/**
 * Clarification 후속 응답 컨텍스트 빌드
 *
 * 사용자의 후속 응답(예: "1번", "첫 번째", 또는 정확한 태스크 이름)을
 * 원본 Skeleton과 결합하여 명확한 instruction으로 변환
 *
 * @param session - 원본 세션
 * @param userResponse - 사용자 후속 응답
 * @param translatedResponse - 번역된 후속 응답 (optional)
 * @returns 컴파일러에 전달할 명확한 instruction
 */
export function buildClarificationContext(
  session: ClarificationSession,
  userResponse: string,
  translatedResponse?: string
): string {
  const { skeleton, resolverError, originalInstruction } = session;
  const candidates = resolverError.candidates;

  // 응답 텍스트 (번역된 것 우선)
  const response = translatedResponse || userResponse;

  // 번호로 선택한 경우 (예: "1번", "1", "첫 번째")
  if (candidates && candidates.length > 0) {
    const idx = parseSelectionIndex(response);
    if (idx !== null && idx >= 0 && idx < candidates.length) {
      const selectedTask = candidates[idx];
      return buildResolvedInstruction(skeleton, selectedTask.title);
    }

    // 후보 중 하나의 제목과 일치하는지 확인
    const matchedTask = candidates.find(t =>
      t.title.toLowerCase().includes(response.toLowerCase()) ||
      response.toLowerCase().includes(t.title.toLowerCase())
    );
    if (matchedTask) {
      return buildResolvedInstruction(skeleton, matchedTask.title);
    }
  }

  // 직접 태스크 이름을 입력한 경우
  // Skeleton의 targetHint를 사용자 응답으로 교체
  return buildResolvedInstruction(skeleton, response);
}

/**
 * Skeleton과 명확해진 task reference로 instruction 생성
 */
function buildResolvedInstruction(skeleton: IntentSkeleton, taskReference: string): string {
  switch (skeleton.kind) {
    case 'ChangeStatus': {
      const s = skeleton as TaskRefSkeleton & { toStatus: string };
      return `Change status of task "${taskReference}" to ${s.toStatus}`;
    }
    case 'UpdateTask': {
      const s = skeleton as TaskRefSkeleton & { changes: Record<string, unknown> };
      const changesStr = Object.entries(s.changes)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ');
      return `Update task "${taskReference}" with changes: ${changesStr}`;
    }
    case 'DeleteTask':
      return `Delete task "${taskReference}"`;
    case 'RestoreTask':
      return `Restore task "${taskReference}"`;
    case 'SelectTask':
      return `Select task "${taskReference}"`;
    default:
      return `Handle task "${taskReference}"`;
  }
}

/**
 * 사용자 응답에서 선택 인덱스 파싱
 *
 * @param response - 사용자 응답
 * @returns 0-based 인덱스 또는 null
 */
function parseSelectionIndex(response: string): number | null {
  const trimmed = response.trim();

  // "1번", "2번" 패턴
  const koreanMatch = trimmed.match(/^(\d+)번?$/);
  if (koreanMatch) {
    return parseInt(koreanMatch[1], 10) - 1;
  }

  // "첫 번째", "두 번째" 패턴
  const koreanOrdinals: Record<string, number> = {
    '첫': 0, '첫 번째': 0, '첫번째': 0,
    '두': 1, '두 번째': 1, '두번째': 1,
    '세': 2, '세 번째': 2, '세번째': 2,
    '네': 3, '네 번째': 3, '네번째': 3,
  };
  for (const [pattern, idx] of Object.entries(koreanOrdinals)) {
    if (trimmed.includes(pattern)) {
      return idx;
    }
  }

  // "first", "second" 패턴
  const englishOrdinals: Record<string, number> = {
    'first': 0, '1st': 0,
    'second': 1, '2nd': 1,
    'third': 2, '3rd': 2,
    'fourth': 3, '4th': 3,
  };
  const lowerTrimmed = trimmed.toLowerCase();
  for (const [pattern, idx] of Object.entries(englishOrdinals)) {
    if (lowerTrimmed.includes(pattern)) {
      return idx;
    }
  }

  return null;
}

// ============================================
// Legacy Compatibility
// ============================================

/**
 * @deprecated Use createClarificationSession instead
 */
export function createSession(
  clarificationIntent: unknown,
  snapshot: Snapshot,
  translatedInstruction?: string
): string {
  // Legacy fallback - create a minimal session
  const sessionId = crypto.randomUUID();
  console.warn('createSession is deprecated. Use createClarificationSession instead.');
  return sessionId;
}

// ============================================
// Debug Utilities
// ============================================

/**
 * 현재 활성 세션 수 조회 (디버깅용)
 */
export function getActiveSessionCount(): number {
  cleanExpiredSessions();
  return sessions.size;
}

/**
 * 모든 세션 삭제 (테스트용)
 */
export function clearAllSessions(): void {
  sessions.clear();
  confirmSessions.clear();
}
