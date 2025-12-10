import type { MigrationDatabase } from '../database.js';
import type { SnapshotRecord } from '../schema.js';

/**
 * 스냅샷 입력
 */
export interface SnapshotInput<TData = unknown, TState = unknown> {
  data: TData;
  state: TState;
  derived: Record<string, unknown>;
}

/**
 * 저장된 스냅샷
 */
export interface StoredSnapshot<TData = unknown, TState = unknown> {
  id: number;
  sessionId: string;
  domain: string;
  version: number;
  data: TData;
  state: TState;
  derived: Record<string, unknown>;
  createdAt: Date;
}

/**
 * 스냅샷 Repository
 */
export class SnapshotRepository {
  constructor(private db: MigrationDatabase) {}

  /**
   * 스냅샷 저장
   */
  save<TData, TState>(
    sessionId: string,
    domain: string,
    snapshot: SnapshotInput<TData, TState>
  ): StoredSnapshot<TData, TState> {
    // 현재 버전 조회
    const latestVersion = this.getLatestVersion(sessionId, domain);
    const newVersion = latestVersion + 1;
    const now = Date.now();

    const stmt = this.db.prepare<{
      session_id: string;
      domain: string;
      version: number;
      data: string;
      state: string;
      derived: string;
      created_at: number;
    }>(`
      INSERT INTO snapshots (session_id, domain, version, data, state, derived, created_at)
      VALUES (@session_id, @domain, @version, @data, @state, @derived, @created_at)
    `);

    const result = stmt.run({
      session_id: sessionId,
      domain,
      version: newVersion,
      data: JSON.stringify(snapshot.data),
      state: JSON.stringify(snapshot.state),
      derived: JSON.stringify(snapshot.derived),
      created_at: now,
    });

    return {
      id: Number(result.lastInsertRowid),
      sessionId,
      domain,
      version: newVersion,
      data: snapshot.data,
      state: snapshot.state,
      derived: snapshot.derived,
      createdAt: new Date(now),
    };
  }

  /**
   * 최신 스냅샷 조회
   */
  getLatest<TData, TState>(
    sessionId: string,
    domain: string
  ): StoredSnapshot<TData, TState> | null {
    const stmt = this.db.prepare<{ session_id: string; domain: string }>(`
      SELECT * FROM snapshots
      WHERE session_id = @session_id AND domain = @domain
      ORDER BY version DESC
      LIMIT 1
    `);

    const row = stmt.get({ session_id: sessionId, domain }) as SnapshotRecord | undefined;
    return row ? this.toSnapshot<TData, TState>(row) : null;
  }

  /**
   * 특정 버전 스냅샷 조회
   */
  getByVersion<TData, TState>(
    sessionId: string,
    domain: string,
    version: number
  ): StoredSnapshot<TData, TState> | null {
    const stmt = this.db.prepare<{ session_id: string; domain: string; version: number }>(`
      SELECT * FROM snapshots
      WHERE session_id = @session_id AND domain = @domain AND version = @version
    `);

    const row = stmt.get({ session_id: sessionId, domain, version }) as SnapshotRecord | undefined;
    return row ? this.toSnapshot<TData, TState>(row) : null;
  }

  /**
   * 스냅샷 히스토리 조회
   */
  getHistory<TData, TState>(
    sessionId: string,
    domain: string,
    limit = 100
  ): StoredSnapshot<TData, TState>[] {
    const stmt = this.db.prepare<{ session_id: string; domain: string; limit: number }>(`
      SELECT * FROM snapshots
      WHERE session_id = @session_id AND domain = @domain
      ORDER BY version DESC
      LIMIT @limit
    `);

    const rows = stmt.all({ session_id: sessionId, domain, limit }) as SnapshotRecord[];
    return rows.map(row => this.toSnapshot<TData, TState>(row));
  }

  /**
   * 모든 도메인의 최신 스냅샷 조회
   */
  getAllLatest(sessionId: string): StoredSnapshot[] {
    const stmt = this.db.prepare<{ session_id: string }>(`
      SELECT s1.* FROM snapshots s1
      INNER JOIN (
        SELECT domain, MAX(version) as max_version
        FROM snapshots
        WHERE session_id = @session_id
        GROUP BY domain
      ) s2 ON s1.domain = s2.domain AND s1.version = s2.max_version
      WHERE s1.session_id = @session_id
    `);

    const rows = stmt.all({ session_id: sessionId }) as SnapshotRecord[];
    return rows.map(row => this.toSnapshot(row));
  }

  /**
   * 도메인의 최신 버전 번호 조회
   */
  getLatestVersion(sessionId: string, domain: string): number {
    const stmt = this.db.prepare<{ session_id: string; domain: string }>(`
      SELECT MAX(version) as max_version FROM snapshots
      WHERE session_id = @session_id AND domain = @domain
    `);

    const result = stmt.get({ session_id: sessionId, domain }) as { max_version: number | null } | undefined;
    return result?.max_version ?? 0;
  }

  /**
   * 세션의 모든 스냅샷 삭제
   */
  deleteBySession(sessionId: string): number {
    const stmt = this.db.prepare<{ session_id: string }>(`
      DELETE FROM snapshots WHERE session_id = @session_id
    `);

    const result = stmt.run({ session_id: sessionId });
    return result.changes;
  }

  /**
   * 특정 버전 이전 스냅샷 삭제 (정리용)
   */
  deleteOlderThan(sessionId: string, domain: string, keepVersions: number): number {
    const stmt = this.db.prepare<{ session_id: string; domain: string; keep: number }>(`
      DELETE FROM snapshots
      WHERE session_id = @session_id
        AND domain = @domain
        AND version <= (
          SELECT MAX(version) - @keep FROM snapshots
          WHERE session_id = @session_id AND domain = @domain
        )
    `);

    const result = stmt.run({ session_id: sessionId, domain, keep: keepVersions });
    return result.changes;
  }

  /**
   * 레코드를 StoredSnapshot 객체로 변환
   */
  private toSnapshot<TData, TState>(record: SnapshotRecord): StoredSnapshot<TData, TState> {
    return {
      id: record.id,
      sessionId: record.session_id,
      domain: record.domain,
      version: record.version,
      data: JSON.parse(record.data) as TData,
      state: JSON.parse(record.state) as TState,
      derived: JSON.parse(record.derived),
      createdAt: new Date(record.created_at),
    };
  }
}
