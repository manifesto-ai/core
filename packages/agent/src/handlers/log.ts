/**
 * @manifesto-ai/agent - Log Emit Handler
 *
 * log.emit Effect 처리:
 * LLM의 메모/추론 과정을 기록.
 * 자연어 출력 대신 log.emit 사용 권장.
 */

import type { LogEmitEffect } from '../types/effect.js';
import type { EffectHandler, HandlerContext } from './registry.js';

/**
 * Log entry 타입
 */
export type LogEntry = {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
  ts: number;
};

/**
 * Log 수집기 인터페이스
 */
export interface LogCollector {
  /** 로그 추가 */
  append(entry: LogEntry): void;
  /** 로그 조회 */
  getAll(): LogEntry[];
  /** 레벨별 필터링 */
  getByLevel(level: LogEntry['level']): LogEntry[];
  /** 로그 초기화 */
  clear(): void;
}

/**
 * 기본 LogCollector 구현
 */
export function createLogCollector(maxEntries: number = 1000): LogCollector {
  const entries: LogEntry[] = [];

  return {
    append(entry: LogEntry): void {
      entries.push(entry);
      // 최대 개수 초과 시 오래된 항목 제거
      if (entries.length > maxEntries) {
        entries.shift();
      }
    },

    getAll(): LogEntry[] {
      return [...entries];
    },

    getByLevel(level: LogEntry['level']): LogEntry[] {
      return entries.filter((e) => e.level === level);
    },

    clear(): void {
      entries.length = 0;
    },
  };
}

/**
 * 콘솔 출력 옵션
 */
export type ConsoleLogOptions = {
  /** 콘솔 출력 활성화 */
  enabled: boolean;
  /** 출력할 최소 레벨 */
  minLevel?: LogEntry['level'];
  /** 커스텀 포맷터 */
  formatter?: (entry: LogEntry) => string;
};

/**
 * 기본 로그 포맷터
 */
export function defaultLogFormatter(entry: LogEntry): string {
  const timestamp = new Date(entry.ts).toISOString();
  const level = entry.level.toUpperCase().padEnd(5);
  let message = `[${timestamp}] ${level} ${entry.message}`;
  if (entry.data !== undefined) {
    message += ` | ${JSON.stringify(entry.data)}`;
  }
  return message;
}

/**
 * 레벨 우선순위
 */
const LEVEL_PRIORITY: Record<LogEntry['level'], number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Log emit handler 생성
 */
export function createLogEmitHandler<S = unknown>(
  collector?: LogCollector,
  consoleOptions?: ConsoleLogOptions
): EffectHandler<LogEmitEffect, S> {
  const logCollector = collector ?? createLogCollector();
  const options = consoleOptions ?? { enabled: false };

  return {
    type: 'log.emit',

    async handle(effect: LogEmitEffect, _ctx: HandlerContext<S>): Promise<void> {
      const entry: LogEntry = {
        id: effect.id,
        level: effect.level,
        message: effect.message,
        data: effect.data,
        ts: Date.now(),
      };

      // 로그 수집
      logCollector.append(entry);

      // 콘솔 출력 (옵션)
      if (options.enabled) {
        const minLevel = options.minLevel ?? 'debug';
        if (LEVEL_PRIORITY[effect.level] >= LEVEL_PRIORITY[minLevel]) {
          const formatter = options.formatter ?? defaultLogFormatter;
          const formatted = formatter(entry);

          switch (effect.level) {
            case 'debug':
              console.debug(formatted);
              break;
            case 'info':
              console.info(formatted);
              break;
            case 'warn':
              console.warn(formatted);
              break;
            case 'error':
              console.error(formatted);
              break;
          }
        }
      }
    },
  };
}

/**
 * 전역 로그 컬렉터 (싱글톤)
 */
let globalLogCollector: LogCollector | null = null;

/**
 * 전역 로그 컬렉터 조회/생성
 */
export function getGlobalLogCollector(): LogCollector {
  if (!globalLogCollector) {
    globalLogCollector = createLogCollector();
  }
  return globalLogCollector;
}

/**
 * 전역 로그 컬렉터 리셋
 */
export function resetGlobalLogCollector(): void {
  globalLogCollector = null;
}
