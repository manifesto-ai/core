import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SubscriptionManager,
  createBatchNotifier,
  type SnapshotListener,
  type PathListener,
  type EventListener,
  type DomainEvent,
} from '../../src/runtime/subscription.js';
import { createSnapshot, setValueByPath } from '../../src/runtime/snapshot.js';

describe('SubscriptionManager', () => {
  type TestData = { name: string; count: number; nested?: { value: string } };
  type TestState = { loading: boolean; items?: string[] };

  let manager: SubscriptionManager<TestData, TestState>;

  beforeEach(() => {
    manager = new SubscriptionManager<TestData, TestState>();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================
  // subscribe (Snapshot Listeners)
  // ===========================================
  describe('subscribe', () => {
    it('should add snapshot listener', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['data.name']);

      expect(listener).toHaveBeenCalledWith(snapshot, ['data.name']);
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      manager.subscribe(listener1);
      manager.subscribe(listener2);
      manager.subscribe(listener3);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['data.name']);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );

      // First call should work
      manager.notifySnapshotChange(snapshot, ['data.name']);
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Second call should not reach listener
      manager.notifySnapshotChange(snapshot, ['data.count']);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      manager.subscribe(errorListener);
      manager.subscribe(normalListener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );

      // Should not throw
      expect(() => {
        manager.notifySnapshotChange(snapshot, ['data.name']);
      }).not.toThrow();

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        'Snapshot listener error:',
        expect.any(Error)
      );
    });
  });

  // ===========================================
  // subscribePath (Path Listeners)
  // ===========================================
  describe('subscribePath', () => {
    it('should add path listener for specific path', () => {
      const listener = vi.fn();
      manager.subscribePath('data.name', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'John', count: 1 },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['data.name']);

      expect(listener).toHaveBeenCalledWith('John', 'data.name');
    });

    it('should not call listener for different path', () => {
      const listener = vi.fn();
      manager.subscribePath('data.name', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'John', count: 10 },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['data.count']);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners for same path', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      manager.subscribePath('data.name', listener1);
      manager.subscribePath('data.name', listener2);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'Jane', count: 1 },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['data.name']);

      expect(listener1).toHaveBeenCalledWith('Jane', 'data.name');
      expect(listener2).toHaveBeenCalledWith('Jane', 'data.name');
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribePath('data.name', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );

      manager.notifySnapshotChange(snapshot, ['data.name']);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      manager.notifySnapshotChange(snapshot, ['data.name']);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should clean up empty path listener sets', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribePath('data.name', listener);

      expect(manager.getSubscriptionCount().path).toBe(1);

      unsubscribe();

      expect(manager.getSubscriptionCount().path).toBe(0);
    });

    it('should handle nested path values', () => {
      const listener = vi.fn();
      manager.subscribePath('data.nested.value', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1, nested: { value: 'deep' } },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['data.nested.value']);

      expect(listener).toHaveBeenCalledWith('deep', 'data.nested.value');
    });

    it('should handle state paths', () => {
      const listener = vi.fn();
      manager.subscribePath('state.loading', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: true }
      );
      manager.notifySnapshotChange(snapshot, ['state.loading']);

      expect(listener).toHaveBeenCalledWith(true, 'state.loading');
    });

    it('should handle derived paths', () => {
      const listener = vi.fn();
      manager.subscribePath('derived.computed', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );
      snapshot.derived = { computed: 42 };
      manager.notifySnapshotChange(snapshot, ['derived.computed']);

      expect(listener).toHaveBeenCalledWith(42, 'derived.computed');
    });

    it('should handle path listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Path listener error');
      });
      const normalListener = vi.fn();

      manager.subscribePath('data.name', errorListener);
      manager.subscribePath('data.name', normalListener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );

      expect(() => {
        manager.notifySnapshotChange(snapshot, ['data.name']);
      }).not.toThrow();

      expect(normalListener).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        'Path listener error:',
        expect.any(Error)
      );
    });
  });

  // ===========================================
  // Wildcard Path Listeners
  // ===========================================
  describe('wildcard path listeners', () => {
    it('should match wildcard pattern data.*', () => {
      const listener = vi.fn();
      manager.subscribePath('data.*', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 10 },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['data.name']);

      expect(listener).toHaveBeenCalledWith('test', 'data.name');
    });

    it('should match nested wildcard pattern', () => {
      const listener = vi.fn();
      manager.subscribePath('data.nested.*', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1, nested: { value: 'hello' } },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['data.nested.value']);

      expect(listener).toHaveBeenCalledWith('hello', 'data.nested.value');
    });

    it('should not match partial prefix', () => {
      const listener = vi.fn();
      manager.subscribePath('data.*', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['dataExtra.something']);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle wildcard listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Wildcard listener error');
      });

      manager.subscribePath('data.*', errorListener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );

      expect(() => {
        manager.notifySnapshotChange(snapshot, ['data.name']);
      }).not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        'Wildcard listener error:',
        expect.any(Error)
      );
    });
  });

  // ===========================================
  // subscribeEvents (Event Listeners)
  // ===========================================
  describe('subscribeEvents', () => {
    it('should add event listener for specific channel', () => {
      const listener = vi.fn();
      manager.subscribeEvents('ui', listener);

      manager.emitEvent('ui', { type: 'toast', message: 'Hello' });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'ui',
          payload: { type: 'toast', message: 'Hello' },
          timestamp: expect.any(Number),
        })
      );
    });

    it('should not call listener for different channel', () => {
      const listener = vi.fn();
      manager.subscribeEvents('ui', listener);

      manager.emitEvent('analytics', { event: 'click' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support wildcard channel "*"', () => {
      const listener = vi.fn();
      manager.subscribeEvents('*', listener);

      manager.emitEvent('ui', { type: 'toast' });
      manager.emitEvent('analytics', { event: 'click' });

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribeEvents('ui', listener);

      manager.emitEvent('ui', { type: 'first' });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      manager.emitEvent('ui', { type: 'second' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should clean up empty event listener sets', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribeEvents('ui', listener);

      expect(manager.getSubscriptionCount().event).toBe(1);

      unsubscribe();

      expect(manager.getSubscriptionCount().event).toBe(0);
    });

    it('should handle event listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Event listener error');
      });
      const normalListener = vi.fn();

      manager.subscribeEvents('ui', errorListener);
      manager.subscribeEvents('ui', normalListener);

      expect(() => {
        manager.emitEvent('ui', { type: 'test' });
      }).not.toThrow();

      expect(normalListener).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        'Event listener error:',
        expect.any(Error)
      );
    });

    it('should handle wildcard listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Wildcard event error');
      });

      manager.subscribeEvents('*', errorListener);

      expect(() => {
        manager.emitEvent('ui', { type: 'test' });
      }).not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        'Event listener error:',
        expect.any(Error)
      );
    });
  });

  // ===========================================
  // emitEvent
  // ===========================================
  describe('emitEvent', () => {
    it('should create event with correct structure', () => {
      const listener = vi.fn();
      manager.subscribeEvents('test', listener);

      const beforeEmit = Date.now();
      manager.emitEvent('test', { data: 'value' });
      const afterEmit = Date.now();

      expect(listener).toHaveBeenCalledWith({
        channel: 'test',
        payload: { data: 'value' },
        timestamp: expect.any(Number),
      });

      const event = listener.mock.calls[0][0] as DomainEvent;
      expect(event.timestamp).toBeGreaterThanOrEqual(beforeEmit);
      expect(event.timestamp).toBeLessThanOrEqual(afterEmit);
    });

    it('should emit to both specific and wildcard listeners', () => {
      const specificListener = vi.fn();
      const wildcardListener = vi.fn();

      manager.subscribeEvents('ui', specificListener);
      manager.subscribeEvents('*', wildcardListener);

      manager.emitEvent('ui', { type: 'toast' });

      expect(specificListener).toHaveBeenCalledTimes(1);
      expect(wildcardListener).toHaveBeenCalledTimes(1);
    });

    it('should handle empty payload', () => {
      const listener = vi.fn();
      manager.subscribeEvents('test', listener);

      manager.emitEvent('test', null);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ payload: null })
      );
    });

    it('should handle complex payload', () => {
      const listener = vi.fn();
      manager.subscribeEvents('test', listener);

      const complexPayload = {
        nested: { deep: { value: 1 } },
        array: [1, 2, 3],
        mixed: { items: [{ id: 1 }] },
      };

      manager.emitEvent('test', complexPayload);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ payload: complexPayload })
      );
    });
  });

  // ===========================================
  // notifySnapshotChange
  // ===========================================
  describe('notifySnapshotChange', () => {
    it('should notify both snapshot and path listeners', () => {
      const snapshotListener = vi.fn();
      const pathListener = vi.fn();

      manager.subscribe(snapshotListener);
      manager.subscribePath('data.name', pathListener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['data.name']);

      expect(snapshotListener).toHaveBeenCalled();
      expect(pathListener).toHaveBeenCalled();
    });

    it('should pass all changed paths to snapshot listener', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 10 },
        { loading: true }
      );
      const changedPaths = ['data.name', 'data.count', 'state.loading'];
      manager.notifySnapshotChange(snapshot, changedPaths);

      expect(listener).toHaveBeenCalledWith(snapshot, changedPaths);
    });

    it('should handle multiple changed paths with path listeners', () => {
      const nameListener = vi.fn();
      const countListener = vi.fn();

      manager.subscribePath('data.name', nameListener);
      manager.subscribePath('data.count', countListener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 42 },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['data.name', 'data.count']);

      expect(nameListener).toHaveBeenCalledWith('test', 'data.name');
      expect(countListener).toHaveBeenCalledWith(42, 'data.count');
    });
  });

  // ===========================================
  // clear
  // ===========================================
  describe('clear', () => {
    it('should remove all listeners', () => {
      manager.subscribe(vi.fn());
      manager.subscribe(vi.fn());
      manager.subscribePath('data.name', vi.fn());
      manager.subscribePath('data.count', vi.fn());
      manager.subscribeEvents('ui', vi.fn());
      manager.subscribeEvents('analytics', vi.fn());

      expect(manager.getSubscriptionCount()).toEqual({
        snapshot: 2,
        path: 2,
        event: 2,
      });

      manager.clear();

      expect(manager.getSubscriptionCount()).toEqual({
        snapshot: 0,
        path: 0,
        event: 0,
      });
    });

    it('should prevent notifications after clear', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      manager.clear();

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['data.name']);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ===========================================
  // getSubscriptionCount
  // ===========================================
  describe('getSubscriptionCount', () => {
    it('should return correct counts', () => {
      expect(manager.getSubscriptionCount()).toEqual({
        snapshot: 0,
        path: 0,
        event: 0,
      });

      manager.subscribe(vi.fn());
      manager.subscribePath('data.name', vi.fn());
      manager.subscribePath('data.name', vi.fn()); // Same path
      manager.subscribePath('data.count', vi.fn());
      manager.subscribeEvents('ui', vi.fn());

      expect(manager.getSubscriptionCount()).toEqual({
        snapshot: 1,
        path: 2, // Two unique paths
        event: 1,
      });
    });

    it('should update counts after unsubscribe', () => {
      const unsub1 = manager.subscribe(vi.fn());
      const unsub2 = manager.subscribe(vi.fn());
      const unsub3 = manager.subscribePath('data.name', vi.fn());

      expect(manager.getSubscriptionCount().snapshot).toBe(2);
      expect(manager.getSubscriptionCount().path).toBe(1);

      unsub1();
      expect(manager.getSubscriptionCount().snapshot).toBe(1);

      unsub2();
      expect(manager.getSubscriptionCount().snapshot).toBe(0);

      unsub3();
      expect(manager.getSubscriptionCount().path).toBe(0);
    });
  });

  // ===========================================
  // getValueFromSnapshot (internal, tested via path listeners)
  // ===========================================
  describe('value extraction from snapshot', () => {
    it('should extract data values correctly', () => {
      const listener = vi.fn();
      manager.subscribePath('data.count', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 999 },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['data.count']);

      expect(listener).toHaveBeenCalledWith(999, 'data.count');
    });

    it('should extract state values correctly', () => {
      const listener = vi.fn();
      manager.subscribePath('state.items', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false, items: ['a', 'b', 'c'] }
      );
      manager.notifySnapshotChange(snapshot, ['state.items']);

      expect(listener).toHaveBeenCalledWith(['a', 'b', 'c'], 'state.items');
    });

    it('should extract derived values correctly', () => {
      const listener = vi.fn();
      manager.subscribePath('derived.total', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );
      snapshot.derived = { total: 100 };
      manager.notifySnapshotChange(snapshot, ['derived.total']);

      expect(listener).toHaveBeenCalledWith(100, 'derived.total');
    });

    it('should handle non-prefixed derived keys', () => {
      const listener = vi.fn();
      manager.subscribePath('customKey', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );
      snapshot.derived = { customKey: 'custom value' };
      manager.notifySnapshotChange(snapshot, ['customKey']);

      expect(listener).toHaveBeenCalledWith('custom value', 'customKey');
    });

    it('should return undefined for missing paths', () => {
      const listener = vi.fn();
      manager.subscribePath('data.missing', listener);

      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test', count: 1 },
        { loading: false }
      );
      manager.notifySnapshotChange(snapshot, ['data.missing']);

      expect(listener).toHaveBeenCalledWith(undefined, 'data.missing');
    });
  });
});

// ===========================================
// createBatchNotifier
// ===========================================
describe('createBatchNotifier', () => {
  type TestData = { name: string };
  type TestState = { loading: boolean };

  let manager: SubscriptionManager<TestData, TestState>;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new SubscriptionManager<TestData, TestState>();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('immediate mode (debounceMs = 0)', () => {
    it('should notify immediately when debounce is 0', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      const notifier = createBatchNotifier(manager, 0);
      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test' },
        { loading: false }
      );

      notifier.queue(snapshot, ['data.name']);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should batch paths from same queue call', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      const notifier = createBatchNotifier(manager, 0);
      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test' },
        { loading: true }
      );

      notifier.queue(snapshot, ['data.name', 'state.loading']);

      expect(listener).toHaveBeenCalledWith(snapshot, ['data.name', 'state.loading']);
    });
  });

  describe('debounced mode', () => {
    it('should debounce notifications', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      const notifier = createBatchNotifier(manager, 100);
      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test' },
        { loading: false }
      );

      notifier.queue(snapshot, ['data.name']);
      expect(listener).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(listener).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should batch multiple queue calls', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      const notifier = createBatchNotifier(manager, 100);
      const snapshot1 = createSnapshot<TestData, TestState>(
        { name: 'first' },
        { loading: false }
      );
      const snapshot2 = createSnapshot<TestData, TestState>(
        { name: 'second' },
        { loading: true }
      );

      notifier.queue(snapshot1, ['data.name']);
      vi.advanceTimersByTime(50);
      notifier.queue(snapshot2, ['state.loading']);

      vi.advanceTimersByTime(100);

      expect(listener).toHaveBeenCalledTimes(1);
      // Should use latest snapshot and accumulated paths
      expect(listener).toHaveBeenCalledWith(
        snapshot2,
        expect.arrayContaining(['data.name', 'state.loading'])
      );
    });

    it('should deduplicate paths', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      const notifier = createBatchNotifier(manager, 100);
      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test' },
        { loading: false }
      );

      notifier.queue(snapshot, ['data.name']);
      notifier.queue(snapshot, ['data.name']); // Duplicate

      vi.advanceTimersByTime(100);

      expect(listener).toHaveBeenCalledTimes(1);
      const paths = listener.mock.calls[0][1] as string[];
      expect(paths.filter(p => p === 'data.name').length).toBe(1);
    });

    it('should reset timer on new queue', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      const notifier = createBatchNotifier(manager, 100);
      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test' },
        { loading: false }
      );

      notifier.queue(snapshot, ['data.name']);
      vi.advanceTimersByTime(80);
      notifier.queue(snapshot, ['state.loading']);
      vi.advanceTimersByTime(80);

      // Should not have fired yet (80 + 80 = 160, but timer was reset)
      expect(listener).not.toHaveBeenCalled();

      vi.advanceTimersByTime(20);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('flush', () => {
    it('should immediately notify when flush is called', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      const notifier = createBatchNotifier(manager, 1000);
      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test' },
        { loading: false }
      );

      notifier.queue(snapshot, ['data.name']);
      expect(listener).not.toHaveBeenCalled();

      notifier.flush();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should clear pending timeout on flush', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      const notifier = createBatchNotifier(manager, 100);
      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test' },
        { loading: false }
      );

      notifier.queue(snapshot, ['data.name']);
      notifier.flush();

      // Advance past original timeout - should not fire again
      vi.advanceTimersByTime(150);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should do nothing if no pending changes', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      const notifier = createBatchNotifier(manager, 100);

      notifier.flush();
      expect(listener).not.toHaveBeenCalled();
    });

    it('should clear pending paths after flush', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      const notifier = createBatchNotifier(manager, 100);
      const snapshot = createSnapshot<TestData, TestState>(
        { name: 'test' },
        { loading: false }
      );

      notifier.queue(snapshot, ['data.name']);
      notifier.flush();

      // Flush again should not call listener
      notifier.flush();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
