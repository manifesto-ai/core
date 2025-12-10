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
