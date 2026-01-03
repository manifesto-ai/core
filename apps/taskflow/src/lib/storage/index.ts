/**
 * Storage Module
 *
 * 확장 가능한 스토리지 레이어
 * - IndexedDB (primary)
 * - localStorage (fallback)
 */

export { storage } from './storage-provider';
export type {
  StorageStrategy,
  StorageData,
  ViewMode,
  DateFilter,
} from './types';
export { STORAGE_KEY, STORAGE_VERSION } from './types';

// Strategy implementations (for testing or custom usage)
export { IndexedDBStrategy } from './indexed-db-strategy';
export { LocalStorageStrategy } from './local-storage-strategy';
