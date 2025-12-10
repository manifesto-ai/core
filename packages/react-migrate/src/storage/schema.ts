/**
 * 현재 스키마 버전
 */
export const SCHEMA_VERSION = 1;

/**
 * 테이블 생성 SQL
 */
export const CREATE_TABLES_SQL = `
-- 스키마 버전 테이블
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

-- 세션 테이블
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  root_dir TEXT NOT NULL,
  output_dir TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  config TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 스냅샷 테이블
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  version INTEGER NOT NULL,
  data TEXT NOT NULL,
  state TEXT NOT NULL,
  derived TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Effect 로그 테이블
CREATE TABLE IF NOT EXISTS effect_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  effect_type TEXT NOT NULL,
  effect_data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  executed_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 파일 분석 캐시 테이블
CREATE TABLE IF NOT EXISTS file_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  analysis TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  UNIQUE(session_id, file_path)
);

-- HITL 히스토리 테이블
CREATE TABLE IF NOT EXISTS hitl_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  file_path TEXT,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  selected_option TEXT NOT NULL,
  custom_input TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_snapshots_session ON snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_domain ON snapshots(domain);
CREATE INDEX IF NOT EXISTS idx_snapshots_version ON snapshots(version);
CREATE INDEX IF NOT EXISTS idx_effect_logs_session ON effect_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_effect_logs_status ON effect_logs(status);
CREATE INDEX IF NOT EXISTS idx_file_analyses_session ON file_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_file_analyses_hash ON file_analyses(file_hash);
CREATE INDEX IF NOT EXISTS idx_hitl_history_session ON hitl_history(session_id);

-- 스키마 버전 삽입
INSERT OR IGNORE INTO schema_version (version) VALUES (${SCHEMA_VERSION});
`;

/**
 * 세션 상태
 */
export type SessionStatus = 'active' | 'completed' | 'failed' | 'paused';

/**
 * Effect 로그 상태
 */
export type EffectLogStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * 세션 레코드
 */
export interface SessionRecord {
  id: string;
  root_dir: string;
  output_dir: string;
  status: SessionStatus;
  config: string;
  created_at: number;
  updated_at: number;
}

/**
 * 스냅샷 레코드
 */
export interface SnapshotRecord {
  id: number;
  session_id: string;
  domain: string;
  version: number;
  data: string;
  state: string;
  derived: string;
  created_at: number;
}

/**
 * Effect 로그 레코드
 */
export interface EffectLogRecord {
  id: number;
  session_id: string;
  domain: string;
  effect_type: string;
  effect_data: string;
  status: EffectLogStatus;
  result: string | null;
  error: string | null;
  created_at: number;
  executed_at: number | null;
}

/**
 * 파일 분석 레코드
 */
export interface FileAnalysisRecord {
  id: number;
  session_id: string;
  file_path: string;
  file_hash: string;
  analysis: string;
  created_at: number;
}

/**
 * HITL 히스토리 레코드
 */
export interface HITLHistoryRecord {
  id: number;
  session_id: string;
  file_path: string | null;
  question: string;
  options: string;
  selected_option: string;
  custom_input: string | null;
  created_at: number;
}
