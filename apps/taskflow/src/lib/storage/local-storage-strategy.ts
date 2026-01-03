/**
 * localStorage Strategy
 *
 * IndexedDB가 사용 불가능할 때의 fallback 스토리지
 * 간단한 JSON serialize/deserialize 기반
 */

import type { StorageStrategy } from './types';

const KEY_PREFIX = 'taskflow:';

export class LocalStorageStrategy implements StorageStrategy {
  readonly name = 'localStorage';

  async isAvailable(): Promise<boolean> {
    try {
      const testKey = `${KEY_PREFIX}__test__`;
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const item = localStorage.getItem(`${KEY_PREFIX}${key}`);
      if (item === null) {
        return null;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      console.error('[LocalStorage] Failed to get:', key, error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(`${KEY_PREFIX}${key}`, serialized);
    } catch (error) {
      console.error('[LocalStorage] Failed to set:', key, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      localStorage.removeItem(`${KEY_PREFIX}${key}`);
    } catch (error) {
      console.error('[LocalStorage] Failed to delete:', key, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      // Only clear keys with our prefix
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error('[LocalStorage] Failed to clear:', error);
      throw error;
    }
  }
}
