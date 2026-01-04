/**
 * Storage Provider
 *
 * 스토리지 전략 자동 선택 및 데이터 영속화 관리
 * - IndexedDB 우선 시도
 * - 실패 시 localStorage로 fallback
 */

import type { StorageStrategy, StorageData } from './types';
import { STORAGE_KEY, STORAGE_VERSION } from './types';
import { IndexedDBStrategy } from './indexed-db-strategy';
import { LocalStorageStrategy } from './local-storage-strategy';

class StorageProvider {
  private strategy: StorageStrategy | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * 스토리지 초기화 - 사용 가능한 스토리지 자동 선택
   */
  async initialize(): Promise<void> {
    // Prevent multiple initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Try IndexedDB first
    const indexedDB = new IndexedDBStrategy();
    if (await indexedDB.isAvailable()) {
      this.strategy = indexedDB;
      console.log('[Storage] Using IndexedDB');
      this.initialized = true;
      return;
    }

    // Fallback to localStorage
    const localStorage = new LocalStorageStrategy();
    if (await localStorage.isAvailable()) {
      this.strategy = localStorage;
      console.log('[Storage] Using localStorage (fallback)');
      this.initialized = true;
      return;
    }

    console.warn('[Storage] No storage available, data will not persist');
    this.initialized = true;
  }

  /**
   * 현재 사용 중인 스토리지 이름
   */
  get strategyName(): string | null {
    return this.strategy?.name ?? null;
  }

  /**
   * 저장된 데이터 로드
   */
  async load(): Promise<StorageData | null> {
    await this.initialize();

    if (!this.strategy) {
      return null;
    }

    try {
      const data = await this.strategy.get<StorageData>(STORAGE_KEY);

      if (!data) {
        return null;
      }

      // Version migration if needed
      if (data.version !== STORAGE_VERSION) {
        console.log(`[Storage] Migrating data from v${data.version} to v${STORAGE_VERSION}`);
        return this.migrate(data);
      }

      return data;
    } catch (error) {
      console.error('[Storage] Failed to load:', error);
      return null;
    }
  }

  /**
   * 데이터 저장
   */
  async save(data: Omit<StorageData, 'version'>): Promise<void> {
    await this.initialize();

    if (!this.strategy) {
      return;
    }

    try {
      const storageData: StorageData = {
        ...data,
        version: STORAGE_VERSION,
      };
      await this.strategy.set(STORAGE_KEY, storageData);
    } catch (error) {
      console.error('[Storage] Failed to save:', error);
      throw error;
    }
  }

  /**
   * 모든 데이터 삭제
   */
  async clear(): Promise<void> {
    await this.initialize();

    if (!this.strategy) {
      return;
    }

    try {
      await this.strategy.clear();
    } catch (error) {
      console.error('[Storage] Failed to clear:', error);
      throw error;
    }
  }

  /**
   * 버전 마이그레이션
   */
  private migrate(data: StorageData): StorageData {
    let migrated = { ...data };

    // v1 → v2: chatHistory, selectedTaskId, lastSessionAt 추가
    if (data.version === 1) {
      migrated = {
        ...migrated,
        selectedTaskId: null,
        chatHistory: [],
        lastSessionAt: new Date().toISOString(),
      };
      console.log('[Storage] Migrated v1 → v2: added chatHistory');
    }

    return {
      ...migrated,
      version: STORAGE_VERSION,
    };
  }
}

// Singleton instance
export const storage = new StorageProvider();
