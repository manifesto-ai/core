import type { SemanticPath } from '../domain/types.js';
import type { DomainSnapshot } from './snapshot.js';

/**
 * 스냅샷 변경 리스너
 */
export type SnapshotListener<TData, TState> = (
  snapshot: DomainSnapshot<TData, TState>,
  changedPaths: SemanticPath[]
) => void;

/**
 * 경로 변경 리스너
 */
export type PathListener = (value: unknown, path: SemanticPath) => void;

/**
 * 이벤트 리스너
 */
export type EventListener = (event: DomainEvent) => void;

/**
 * 도메인 이벤트
 */
export type DomainEvent = {
  channel: string;
  payload: unknown;
  timestamp: number;
};

/**
 * 구독 해제 함수
 */
export type Unsubscribe = () => void;

/**
 * Subscription Manager
 *
 * ## Notify Policy (P1-2)
 *
 * **changedPaths는 "값 변화"가 아니라 "set 시도/전파 이벤트" 기준입니다.**
 *
 * - `runtime.set(path, value)`가 호출되면 값이 동일하더라도 path가 changedPaths에 포함됩니다.
 * - 이는 "값 변화 감지" 보다 "상태 전이 이벤트" 관점의 설계입니다.
 *
 * **설계 의도:**
 * 1. **결정론적 동작**: 동일한 set 호출은 항상 동일한 알림을 생성합니다.
 * 2. **디버깅 용이성**: 모든 set 시도를 추적할 수 있습니다.
 * 3. **의존성 전파**: DAG 전파 로직과 일관된 동작을 보장합니다.
 *
 * **성능 고려:**
 * 값 변화 없는 알림이 성능 문제가 되는 경우, React 훅에서 `useSyncExternalStore`의
 * `getSnapshot`이 동일 참조를 반환하도록 최적화하거나, 컴포넌트 레벨에서 memo를 사용하세요.
 *
 * @example
 * ```typescript
 * // 값이 동일해도 알림 발생 (의도된 동작)
 * runtime.set('data.count', 10);  // → notify
 * runtime.set('data.count', 10);  // → notify (같은 값이지만 알림)
 *
 * // React에서 불필요한 리렌더 방지
 * const count = useValue('data.count');  // useSyncExternalStore 내부에서 참조 비교
 * ```
 */
export class SubscriptionManager<TData, TState> {
  private snapshotListeners = new Set<SnapshotListener<TData, TState>>();
  private pathListeners = new Map<SemanticPath, Set<PathListener>>();
  private eventListeners = new Map<string, Set<EventListener>>();

  /**
   * 스냅샷 변경 구독
   */
  subscribe(listener: SnapshotListener<TData, TState>): Unsubscribe {
    this.snapshotListeners.add(listener);
    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  /**
   * 특정 경로 변경 구독
   */
  subscribePath(path: SemanticPath, listener: PathListener): Unsubscribe {
    if (!this.pathListeners.has(path)) {
      this.pathListeners.set(path, new Set());
    }
    this.pathListeners.get(path)!.add(listener);

    return () => {
      const listeners = this.pathListeners.get(path);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.pathListeners.delete(path);
        }
      }
    };
  }

  /**
   * 이벤트 구독
   */
  subscribeEvents(channel: string, listener: EventListener): Unsubscribe {
    if (!this.eventListeners.has(channel)) {
      this.eventListeners.set(channel, new Set());
    }
    this.eventListeners.get(channel)!.add(listener);

    return () => {
      const listeners = this.eventListeners.get(channel);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.eventListeners.delete(channel);
        }
      }
    };
  }

  /**
   * 스냅샷 변경 알림
   */
  notifySnapshotChange(
    snapshot: DomainSnapshot<TData, TState>,
    changedPaths: SemanticPath[]
  ): void {
    // 스냅샷 리스너 호출
    for (const listener of this.snapshotListeners) {
      try {
        listener(snapshot, changedPaths);
      } catch (e) {
        console.error('Snapshot listener error:', e);
      }
    }

    // 경로 리스너 호출
    for (const path of changedPaths) {
      const listeners = this.pathListeners.get(path);
      if (listeners) {
        const value = this.getValueFromSnapshot(snapshot, path);
        for (const listener of listeners) {
          try {
            listener(value, path);
          } catch (e) {
            console.error('Path listener error:', e);
          }
        }
      }

      // 와일드카드 경로 매칭
      this.notifyWildcardListeners(snapshot, path);
    }
  }

  /**
   * 이벤트 발행
   */
  emitEvent(channel: string, payload: unknown): void {
    const event: DomainEvent = {
      channel,
      payload,
      timestamp: Date.now(),
    };

    const listeners = this.eventListeners.get(channel);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (e) {
          console.error('Event listener error:', e);
        }
      }
    }

    // 'all' 채널 리스너도 호출
    const allListeners = this.eventListeners.get('*');
    if (allListeners) {
      for (const listener of allListeners) {
        try {
          listener(event);
        } catch (e) {
          console.error('Event listener error:', e);
        }
      }
    }
  }

  /**
   * 와일드카드 리스너 알림
   */
  private notifyWildcardListeners(
    snapshot: DomainSnapshot<TData, TState>,
    changedPath: SemanticPath
  ): void {
    for (const [pattern, listeners] of this.pathListeners) {
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -2);
        if (changedPath.startsWith(prefix + '.')) {
          const value = this.getValueFromSnapshot(snapshot, changedPath);
          for (const listener of listeners) {
            try {
              listener(value, changedPath);
            } catch (e) {
              console.error('Wildcard listener error:', e);
            }
          }
        }
      }
    }
  }

  /**
   * 스냅샷에서 값 조회
   */
  private getValueFromSnapshot(
    snapshot: DomainSnapshot<TData, TState>,
    path: SemanticPath
  ): unknown {
    if (path.startsWith('data.')) {
      return getNestedValue(snapshot.data, path.slice(5));
    }
    if (path.startsWith('state.')) {
      return getNestedValue(snapshot.state, path.slice(6));
    }
    if (path.startsWith('derived.')) {
      return snapshot.derived[path.slice(8)];
    }
    return snapshot.derived[path];
  }

  /**
   * 모든 구독 해제
   */
  clear(): void {
    this.snapshotListeners.clear();
    this.pathListeners.clear();
    this.eventListeners.clear();
  }

  /**
   * 구독 수 반환
   */
  getSubscriptionCount(): {
    snapshot: number;
    path: number;
    event: number;
  } {
    return {
      snapshot: this.snapshotListeners.size,
      path: this.pathListeners.size,
      event: this.eventListeners.size,
    };
  }
}

/**
 * 중첩된 객체에서 값 가져오기
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return obj;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * 배치 알림을 위한 유틸리티
 */
export function createBatchNotifier<TData, TState>(
  manager: SubscriptionManager<TData, TState>,
  debounceMs = 0
): {
  queue: (snapshot: DomainSnapshot<TData, TState>, paths: SemanticPath[]) => void;
  flush: () => void;
} {
  let pendingSnapshot: DomainSnapshot<TData, TState> | null = null;
  let pendingPaths = new Set<SemanticPath>();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return {
    queue(snapshot: DomainSnapshot<TData, TState>, paths: SemanticPath[]): void {
      pendingSnapshot = snapshot;
      for (const path of paths) {
        pendingPaths.add(path);
      }

      if (debounceMs === 0) {
        this.flush();
      } else {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => this.flush(), debounceMs);
      }
    },

    flush(): void {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (pendingSnapshot && pendingPaths.size > 0) {
        manager.notifySnapshotChange(pendingSnapshot, [...pendingPaths]);
        pendingPaths = new Set();
      }
    },
  };
}
