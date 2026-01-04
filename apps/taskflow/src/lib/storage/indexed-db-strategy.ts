/**
 * IndexedDB Strategy
 *
 * Primary 스토리지 - 대용량 데이터 지원
 * localStorage보다 더 많은 데이터 저장 가능
 */

import type { StorageStrategy } from './types';

const DB_NAME = 'taskflow-db';
const DB_VERSION = 1;
const STORE_NAME = 'app-state';

export class IndexedDBStrategy implements StorageStrategy {
  readonly name = 'IndexedDB';
  private db: IDBDatabase | null = null;

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }

    if (!window.indexedDB) {
      return false;
    }

    try {
      // Actually try to open a database to verify it works
      const db = await this.openDB();
      db.close();
      this.db = null;
      return true;
    } catch {
      return false;
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }
    this.db = await this.openDB();
    return this.db;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onerror = () => {
          reject(new Error(`Failed to get from IndexedDB: ${request.error?.message}`));
        };

        request.onsuccess = () => {
          resolve(request.result ?? null);
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Failed to get:', key, error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onerror = () => {
          reject(new Error(`Failed to set in IndexedDB: ${request.error?.message}`));
        };

        request.onsuccess = () => {
          resolve();
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Failed to set:', key, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onerror = () => {
          reject(new Error(`Failed to delete from IndexedDB: ${request.error?.message}`));
        };

        request.onsuccess = () => {
          resolve();
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Failed to delete:', key, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onerror = () => {
          reject(new Error(`Failed to clear IndexedDB: ${request.error?.message}`));
        };

        request.onsuccess = () => {
          resolve();
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Failed to clear:', error);
      throw error;
    }
  }
}
