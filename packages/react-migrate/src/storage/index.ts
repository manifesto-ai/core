// Schema
export {
  SCHEMA_VERSION,
  CREATE_TABLES_SQL,
  type SessionStatus,
  type EffectLogStatus,
  type SessionRecord,
  type SnapshotRecord,
  type EffectLogRecord,
  type FileAnalysisRecord,
  type HITLHistoryRecord,
} from './schema.js';

// Database
export {
  MigrationDatabase,
  getDefaultDatabasePath,
  createDatabase,
  type DatabaseOptions,
} from './database.js';

// Repositories
export {
  SessionRepository,
  SnapshotRepository,
  EffectLogRepository,
  type CreateSessionInput,
  type UpdateSessionInput,
  type Session,
  type SnapshotInput,
  type StoredSnapshot,
  type EffectLogInput,
  type StoredEffectLog,
} from './repositories/index.js';

import type { MigrationDatabase } from './database.js';
import { SessionRepository } from './repositories/session.js';
import { SnapshotRepository } from './repositories/snapshot.js';
import { EffectLogRepository } from './repositories/effect-log.js';

/**
 * 모든 Repository를 포함한 Storage 객체
 */
export interface Storage {
  db: MigrationDatabase;
  sessions: SessionRepository;
  snapshots: SnapshotRepository;
  effectLogs: EffectLogRepository;
}

/**
 * Storage 객체 생성
 */
export function createStorage(db: MigrationDatabase): Storage {
  return {
    db,
    sessions: new SessionRepository(db),
    snapshots: new SnapshotRepository(db),
    effectLogs: new EffectLogRepository(db),
  };
}
