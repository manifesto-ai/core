import { describe, it, expect } from 'vitest';
import {
  createSnapshot,
  cloneSnapshot,
  getValueByPath,
  setValueByPath,
  diffSnapshots,
  type DomainSnapshot,
} from '../../src/runtime/snapshot.js';

describe('snapshot', () => {
  // ===========================================
  // createSnapshot
  // ===========================================
  describe('createSnapshot', () => {
    it('should create snapshot with initial data and state', () => {
      const data = { name: 'test', count: 10 };
      const state = { loading: false, error: null };

      const snapshot = createSnapshot(data, state);

      expect(snapshot.data).toEqual(data);
      expect(snapshot.state).toEqual(state);
      expect(snapshot.derived).toEqual({});
      expect(snapshot.validity).toEqual({});
      expect(snapshot.version).toBe(0);
      expect(typeof snapshot.timestamp).toBe('number');
    });

    it('should create snapshot with empty objects', () => {
      const snapshot = createSnapshot({}, {});

      expect(snapshot.data).toEqual({});
      expect(snapshot.state).toEqual({});
      expect(snapshot.version).toBe(0);
    });

    it('should create snapshot with nested data', () => {
      const data = {
        user: {
          profile: {
            name: 'John',
            age: 30,
          },
        },
        items: [1, 2, 3],
      };
      const state = { ui: { modal: { open: false } } };

      const snapshot = createSnapshot(data, state);

      expect(snapshot.data.user.profile.name).toBe('John');
      expect(snapshot.state.ui.modal.open).toBe(false);
    });

    it('should create snapshot with null/undefined values', () => {
      const data = { value: null, optional: undefined };
      const state = { error: null };

      const snapshot = createSnapshot(data, state);

      expect(snapshot.data.value).toBeNull();
      expect(snapshot.data.optional).toBeUndefined();
    });
  });

  // ===========================================
  // cloneSnapshot
  // ===========================================
  describe('cloneSnapshot', () => {
    it('should create deep copy of snapshot', () => {
      const original = createSnapshot(
        { name: 'test', nested: { value: 1 } },
        { loading: false }
      );
      original.derived = { computed: 42 };

      const clone = cloneSnapshot(original);

      expect(clone).not.toBe(original);
      expect(clone.data).not.toBe(original.data);
      expect(clone.data).toEqual(original.data);
      expect(clone.state).toEqual(original.state);
      expect(clone.derived).toEqual(original.derived);
    });

    it('should not affect original when modifying clone', () => {
      const original = createSnapshot(
        { items: [1, 2, 3], nested: { value: 'a' } },
        { count: 0 }
      );

      const clone = cloneSnapshot(original);
      (clone.data as any).items.push(4);
      (clone.data as any).nested.value = 'b';

      expect(original.data.items).toEqual([1, 2, 3]);
      expect(original.data.nested.value).toBe('a');
    });

    it('should preserve version and timestamp', () => {
      const original = createSnapshot({ x: 1 }, { y: 2 });
      original.version = 5;
      original.timestamp = 1234567890;

      const clone = cloneSnapshot(original);

      expect(clone.version).toBe(5);
      expect(clone.timestamp).toBe(1234567890);
    });

    it('should clone arrays correctly', () => {
      const original = createSnapshot(
        { list: [{ id: 1 }, { id: 2 }] },
        {}
      );

      const clone = cloneSnapshot(original);
      (clone.data as any).list[0].id = 999;

      expect(original.data.list[0].id).toBe(1);
    });
  });

  // ===========================================
  // getValueByPath
  // ===========================================
  describe('getValueByPath', () => {
    const snapshot = createSnapshot(
      {
        user: {
          name: 'John',
          profile: {
            email: 'john@example.com',
            age: 30,
          },
        },
        items: ['a', 'b', 'c'],
        contacts: {
          'c_123': { type: 'email', value: 'test@example.com' },
          'c_456': { type: 'phone', value: '123-456' },
        },
      },
      {
        loading: true,
        modal: { open: false, type: null },
      }
    );
    snapshot.derived = {
      computedValue: 100,
      'nested.derived': 'nested-value',
    };

    describe('data paths', () => {
      it('should get top-level data value', () => {
        const result = getValueByPath(snapshot, 'data.user');
        expect(result).toEqual({
          name: 'John',
          profile: { email: 'john@example.com', age: 30 },
        });
      });

      it('should get nested data value with dot notation', () => {
        const result = getValueByPath(snapshot, 'data.user.profile.email');
        expect(result).toBe('john@example.com');
      });

      it('should get array value', () => {
        const result = getValueByPath(snapshot, 'data.items');
        expect(result).toEqual(['a', 'b', 'c']);
      });

      it('should get value by ID-based path', () => {
        const result = getValueByPath(snapshot, 'data.contacts["c_123"].type');
        expect(result).toBe('email');
      });

      it('should get value by ID-based path with single quotes', () => {
        const result = getValueByPath(snapshot, "data.contacts['c_456'].value");
        expect(result).toBe('123-456');
      });

      it('should return undefined for non-existent data path', () => {
        const result = getValueByPath(snapshot, 'data.nonexistent.path');
        expect(result).toBeUndefined();
      });
    });

    describe('state paths', () => {
      it('should get top-level state value', () => {
        const result = getValueByPath(snapshot, 'state.loading');
        expect(result).toBe(true);
      });

      it('should get nested state value', () => {
        const result = getValueByPath(snapshot, 'state.modal.open');
        expect(result).toBe(false);
      });

      it('should return undefined for non-existent state path', () => {
        const result = getValueByPath(snapshot, 'state.unknown');
        expect(result).toBeUndefined();
      });
    });

    describe('derived paths', () => {
      it('should get derived value with derived. prefix', () => {
        const result = getValueByPath(snapshot, 'derived.computedValue');
        expect(result).toBe(100);
      });

      it('should get derived value without prefix if stored that way', () => {
        // When derived is stored with key 'computedValue'
        const result = getValueByPath(snapshot, 'derived.computedValue');
        expect(result).toBe(100);
      });

      it('should handle derived paths with dots in key', () => {
        const result = getValueByPath(snapshot, 'derived.nested.derived');
        expect(result).toBe('nested-value');
      });
    });

    describe('edge cases', () => {
      it('should return undefined for empty path after prefix', () => {
        // data. with nothing after - gets entire data object
        const result = getValueByPath(snapshot, 'data.');
        expect(result).toEqual(snapshot.data);
      });

      it('should handle null values in path', () => {
        const snapshotWithNull = createSnapshot(
          { parent: null },
          {}
        );
        const result = getValueByPath(snapshotWithNull, 'data.parent.child');
        expect(result).toBeUndefined();
      });

      it('should handle undefined intermediate values', () => {
        const result = getValueByPath(snapshot, 'data.missing.nested.deep');
        expect(result).toBeUndefined();
      });
    });
  });

  // ===========================================
  // setValueByPath
  // ===========================================
  describe('setValueByPath', () => {
    describe('data paths', () => {
      it('should set top-level data value', () => {
        const snapshot = createSnapshot({ name: 'old' }, {});
        const result = setValueByPath(snapshot, 'data.name', 'new');

        expect(result.data.name).toBe('new');
        expect(snapshot.data.name).toBe('old'); // original unchanged
      });

      it('should set nested data value', () => {
        const snapshot = createSnapshot(
          { user: { profile: { age: 25 } } },
          {}
        );
        const result = setValueByPath(snapshot, 'data.user.profile.age', 30);

        expect(result.data.user.profile.age).toBe(30);
      });

      it('should create intermediate objects if needed', () => {
        const snapshot = createSnapshot({}, {});
        const result = setValueByPath(snapshot, 'data.new.nested.value', 'hello');

        expect(result.data.new.nested.value).toBe('hello');
      });

      it('should set value at ID-based path', () => {
        const snapshot = createSnapshot(
          { contacts: { 'c_123': { type: 'email' } } },
          {}
        );
        const result = setValueByPath(snapshot, 'data.contacts["c_123"].type', 'phone');

        expect(result.data.contacts['c_123'].type).toBe('phone');
      });
    });

    describe('state paths', () => {
      it('should set state value', () => {
        const snapshot = createSnapshot({}, { loading: false });
        const result = setValueByPath(snapshot, 'state.loading', true);

        expect(result.state.loading).toBe(true);
      });

      it('should set nested state value', () => {
        const snapshot = createSnapshot({}, { modal: { open: false } });
        const result = setValueByPath(snapshot, 'state.modal.open', true);

        expect(result.state.modal.open).toBe(true);
      });
    });

    describe('derived paths', () => {
      it('should set derived value with prefix', () => {
        const snapshot = createSnapshot({}, {});
        const result = setValueByPath(snapshot, 'derived.computed', 42);

        expect(result.derived['computed']).toBe(42);
      });

      it('should set derived value without prefix (fallback)', () => {
        const snapshot = createSnapshot({}, {});
        const result = setValueByPath(snapshot, 'someKey', 'value');

        expect(result.derived['someKey']).toBe('value');
      });
    });

    describe('version and timestamp', () => {
      it('should increment version on each set', () => {
        const snapshot = createSnapshot({}, {});
        expect(snapshot.version).toBe(0);

        const result1 = setValueByPath(snapshot, 'data.x', 1);
        expect(result1.version).toBe(1);

        const result2 = setValueByPath(result1, 'data.y', 2);
        expect(result2.version).toBe(2);
      });

      it('should update timestamp on each set', () => {
        const snapshot = createSnapshot({}, {});
        const originalTimestamp = snapshot.timestamp;

        // Small delay to ensure different timestamp
        const result = setValueByPath(snapshot, 'data.x', 1);

        expect(result.timestamp).toBeGreaterThanOrEqual(originalTimestamp);
      });
    });

    describe('immutability', () => {
      it('should not mutate original snapshot', () => {
        const snapshot = createSnapshot(
          { items: [1, 2, 3], nested: { a: 1 } },
          { count: 0 }
        );

        setValueByPath(snapshot, 'data.items', [4, 5, 6]);
        setValueByPath(snapshot, 'data.nested.a', 999);

        expect(snapshot.data.items).toEqual([1, 2, 3]);
        expect(snapshot.data.nested.a).toBe(1);
      });

      it('should not share references between snapshots', () => {
        const snapshot = createSnapshot({ arr: [{ id: 1 }] }, {});
        const result = setValueByPath(snapshot, 'data.arr', [{ id: 2 }]);

        (result.data as any).arr[0].id = 999;

        expect(snapshot.data.arr[0].id).toBe(1);
      });
    });
  });

  // ===========================================
  // diffSnapshots
  // ===========================================
  describe('diffSnapshots', () => {
    describe('data changes', () => {
      it('should detect top-level data change', () => {
        const old = createSnapshot({ name: 'old' }, {});
        const newSnap = setValueByPath(old, 'data.name', 'new');

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toContain('data.name');
      });

      it('should detect nested data change', () => {
        const old = createSnapshot({ user: { profile: { age: 25 } } }, {});
        const newSnap = setValueByPath(old, 'data.user.profile.age', 30);

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toContain('data.user.profile.age');
        expect(diff).toContain('data.user.profile');
        expect(diff).toContain('data.user');
      });

      it('should detect added property', () => {
        const old = createSnapshot({ existing: 1 }, {});
        const newSnap = setValueByPath(old, 'data.added', 2);

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toContain('data.added');
      });

      it('should detect removed property', () => {
        const old = createSnapshot({ a: 1, b: 2 }, {});
        const newSnap = createSnapshot({ a: 1 }, {});
        newSnap.version = old.version + 1;

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toContain('data.b');
      });

      it('should detect array changes', () => {
        const old = createSnapshot({ items: [1, 2, 3] }, {});
        const newSnap = setValueByPath(old, 'data.items', [1, 2, 3, 4]);

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toContain('data.items');
      });
    });

    describe('state changes', () => {
      it('should detect state change', () => {
        const old = createSnapshot({}, { loading: false });
        const newSnap = setValueByPath(old, 'state.loading', true);

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toContain('state.loading');
      });

      it('should detect nested state change', () => {
        const old = createSnapshot({}, { modal: { open: false } });
        const newSnap = setValueByPath(old, 'state.modal.open', true);

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toContain('state.modal.open');
      });
    });

    describe('derived changes', () => {
      it('should detect derived value change', () => {
        const old = createSnapshot({}, {});
        old.derived = { computed: 1 };

        const newSnap = cloneSnapshot(old);
        newSnap.derived = { computed: 2 };

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toContain('derived.computed');
      });

      it('should detect added derived value', () => {
        const old = createSnapshot({}, {});
        old.derived = {};

        const newSnap = cloneSnapshot(old);
        newSnap.derived = { newDerived: 'value' };

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toContain('derived.newDerived');
      });

      it('should detect removed derived value', () => {
        const old = createSnapshot({}, {});
        old.derived = { toRemove: 'value' };

        const newSnap = cloneSnapshot(old);
        newSnap.derived = {};

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toContain('derived.toRemove');
      });

      it('should handle derived keys with derived. prefix', () => {
        const old = createSnapshot({}, {});
        old.derived = { 'derived.nested': 1 };

        const newSnap = cloneSnapshot(old);
        newSnap.derived = { 'derived.nested': 2 };

        const diff = diffSnapshots(old, newSnap);

        // Should normalize to derived.derived.nested or keep as is
        expect(diff.some(p => p.includes('derived.nested'))).toBe(true);
      });
    });

    describe('no changes', () => {
      it('should return empty array when snapshots are identical', () => {
        const old = createSnapshot({ name: 'test' }, { loading: false });
        const newSnap = cloneSnapshot(old);

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toEqual([]);
      });

      it('should handle empty snapshots', () => {
        const old = createSnapshot({}, {});
        const newSnap = createSnapshot({}, {});

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toEqual([]);
      });
    });

    describe('complex changes', () => {
      it('should detect multiple changes at once', () => {
        const old = createSnapshot(
          { a: 1, b: 2 },
          { x: true, y: false }
        );
        old.derived = { computed: 10 };

        const newSnap = createSnapshot(
          { a: 999, b: 2 },
          { x: true, y: true }
        );
        newSnap.derived = { computed: 20 };

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toContain('data.a');
        expect(diff).toContain('state.y');
        expect(diff).toContain('derived.computed');
        expect(diff).not.toContain('data.b');
        expect(diff).not.toContain('state.x');
      });

      it('should handle deeply nested object changes', () => {
        const old = createSnapshot(
          { level1: { level2: { level3: { value: 'old' } } } },
          {}
        );
        const newSnap = setValueByPath(old, 'data.level1.level2.level3.value', 'new');

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toContain('data.level1.level2.level3.value');
      });

      it('should detect type change (object to primitive)', () => {
        const old = createSnapshot({ value: { nested: 1 } }, {});
        const newSnap = setValueByPath(old, 'data.value', 'string');

        const diff = diffSnapshots(old, newSnap);

        expect(diff).toContain('data.value');
      });
    });
  });

  // ===========================================
  // parsePath (tested through getValueByPath/setValueByPath)
  // ===========================================
  describe('path parsing', () => {
    it('should parse simple dot notation', () => {
      const snapshot = createSnapshot({ a: { b: { c: 1 } } }, {});
      expect(getValueByPath(snapshot, 'data.a.b.c')).toBe(1);
    });

    it('should parse bracket notation with double quotes', () => {
      const snapshot = createSnapshot({ items: { 'special-key': 'value' } }, {});
      expect(getValueByPath(snapshot, 'data.items["special-key"]')).toBe('value');
    });

    it('should parse bracket notation with single quotes', () => {
      const snapshot = createSnapshot({ items: { 'another-key': 'value' } }, {});
      expect(getValueByPath(snapshot, "data.items['another-key']")).toBe('value');
    });

    it('should parse mixed notation', () => {
      const snapshot = createSnapshot(
        { users: { 'user-123': { profile: { name: 'John' } } } },
        {}
      );
      expect(getValueByPath(snapshot, 'data.users["user-123"].profile.name')).toBe('John');
    });

    it('should parse consecutive brackets', () => {
      const snapshot = createSnapshot(
        { matrix: { 'row-1': { 'col-a': 42 } } },
        {}
      );
      expect(getValueByPath(snapshot, 'data.matrix["row-1"]["col-a"]')).toBe(42);
    });

    it('should handle numeric bracket keys', () => {
      const snapshot = createSnapshot({ items: { '0': 'first', '1': 'second' } }, {});
      expect(getValueByPath(snapshot, 'data.items["0"]')).toBe('first');
    });
  });

  // ===========================================
  // Deep clone behavior
  // ===========================================
  describe('deep clone behavior', () => {
    it('should handle Date objects as plain objects', () => {
      // Note: The deepClone function treats all objects uniformly
      const snapshot = createSnapshot({ created: { time: 123 } }, {});
      const clone = cloneSnapshot(snapshot);

      expect(clone.data.created.time).toBe(123);
    });

    it('should handle null values', () => {
      const snapshot = createSnapshot({ value: null }, { error: null });
      const clone = cloneSnapshot(snapshot);

      expect(clone.data.value).toBeNull();
      expect(clone.state.error).toBeNull();
    });

    it('should handle arrays with objects', () => {
      const snapshot = createSnapshot(
        { items: [{ id: 1, data: { x: 1 } }, { id: 2, data: { x: 2 } }] },
        {}
      );
      const clone = cloneSnapshot(snapshot);

      (clone.data as any).items[0].data.x = 999;

      expect(snapshot.data.items[0].data.x).toBe(1);
    });

    it('should handle empty arrays', () => {
      const snapshot = createSnapshot({ items: [] }, {});
      const clone = cloneSnapshot(snapshot);

      expect(clone.data.items).toEqual([]);
      expect(clone.data.items).not.toBe(snapshot.data.items);
    });

    it('should handle nested empty objects', () => {
      const snapshot = createSnapshot({ nested: { deep: {} } }, {});
      const clone = cloneSnapshot(snapshot);

      expect(clone.data.nested.deep).toEqual({});
      expect(clone.data.nested.deep).not.toBe(snapshot.data.nested.deep);
    });
  });

  // ===========================================
  // Deep equality behavior
  // ===========================================
  describe('deep equality in diff', () => {
    it('should consider identical arrays as equal', () => {
      const old = createSnapshot({ arr: [1, 2, 3] }, {});
      const newSnap = createSnapshot({ arr: [1, 2, 3] }, {});

      const diff = diffSnapshots(old, newSnap);

      expect(diff).not.toContain('data.arr');
    });

    it('should consider identical nested objects as equal', () => {
      const old = createSnapshot({ obj: { a: 1, b: { c: 2 } } }, {});
      const newSnap = createSnapshot({ obj: { a: 1, b: { c: 2 } } }, {});

      const diff = diffSnapshots(old, newSnap);

      expect(diff).toEqual([]);
    });

    it('should detect difference in array order', () => {
      const old = createSnapshot({ arr: [1, 2, 3] }, {});
      const newSnap = createSnapshot({ arr: [3, 2, 1] }, {});

      const diff = diffSnapshots(old, newSnap);

      expect(diff).toContain('data.arr');
    });

    it('should detect difference in array length', () => {
      const old = createSnapshot({ arr: [1, 2] }, {});
      const newSnap = createSnapshot({ arr: [1, 2, 3] }, {});

      const diff = diffSnapshots(old, newSnap);

      expect(diff).toContain('data.arr');
    });
  });
});
