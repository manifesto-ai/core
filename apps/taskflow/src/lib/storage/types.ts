/**
 * Storage Layer Types
 *
 * Strategy Pattern을 위한 인터페이스 정의
 * - IndexedDB (primary)
 * - localStorage (fallback)
 * - 추후 Cloud storage 등 확장 가능
 */

import type { Task } from '@/manifesto';
import type { DateFilter } from '@/components/ui/date-range-picker';

// ============================================
// Storage Strategy Interface
// ============================================

export interface StorageStrategy {
  /** Strategy 이름 (디버깅용) */
  readonly name: string;

  /** 이 스토리지가 사용 가능한지 확인 */
  isAvailable(): Promise<boolean>;

  /** 키로 데이터 읽기 */
  get<T>(key: string): Promise<T | null>;

  /** 키에 데이터 저장 */
  set<T>(key: string, value: T): Promise<void>;

  /** 키의 데이터 삭제 */
  delete(key: string): Promise<void>;

  /** 모든 데이터 삭제 */
  clear(): Promise<void>;
}

// ============================================
// App Data Types
// ============================================

export type ViewMode = 'todo' | 'kanban' | 'table' | 'trash';

// Re-export DateFilter from date-range-picker
export type { DateFilter } from '@/components/ui/date-range-picker';

/** 채팅 메시지 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/** 영속화할 데이터 구조 */
export interface StorageData {
  version: number;
  tasks: Task[];
  viewMode: ViewMode;
  dateFilter: DateFilter | null;
  // v2: 채팅 히스토리 추가
  selectedTaskId: string | null;
  chatHistory: ChatMessage[];
  lastSessionAt: string;
}

// ============================================
// Constants
// ============================================

export const STORAGE_KEY = 'taskflow-data';
export const STORAGE_VERSION = 2;
export const MAX_CHAT_MESSAGES = 100;
