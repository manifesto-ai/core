import type { MigrationDatabase } from '../database.js';
import type { EffectLogRecord, EffectLogStatus } from '../schema.js';

/**
 * Effect 로그 입력
 */
export interface EffectLogInput {
  domain: string;
  effectType: string;
  effectData: Record<string, unknown>;
}

/**
 * 저장된 Effect 로그
 */
export interface StoredEffectLog {
  id: number;
  sessionId: string;
  domain: string;
  effectType: string;
  effectData: Record<string, unknown>;
  status: EffectLogStatus;
  result: unknown | null;
  error: string | null;
  createdAt: Date;
  executedAt: Date | null;
}

/**
 * Effect 로그 Repository
 */
export class EffectLogRepository {
  constructor(private db: MigrationDatabase) {}

  /**
   * Effect 로그 생성
   */
  create(sessionId: string, input: EffectLogInput): StoredEffectLog {
    const now = Date.now();

    const stmt = this.db.prepare<{
      session_id: string;
      domain: string;
      effect_type: string;
      effect_data: string;
      status: string;
      created_at: number;
    }>(`
      INSERT INTO effect_logs (session_id, domain, effect_type, effect_data, status, created_at)
      VALUES (@session_id, @domain, @effect_type, @effect_data, @status, @created_at)
    `);

    const result = stmt.run({
      session_id: sessionId,
      domain: input.domain,
      effect_type: input.effectType,
      effect_data: JSON.stringify(input.effectData),
      status: 'pending',
      created_at: now,
    });

    return {
      id: Number(result.lastInsertRowid),
      sessionId,
      domain: input.domain,
      effectType: input.effectType,
      effectData: input.effectData,
      status: 'pending',
      result: null,
      error: null,
      createdAt: new Date(now),
      executedAt: null,
    };
  }

  /**
   * Effect 실행 시작
   */
  markRunning(id: number): void {
    const stmt = this.db.prepare<{ id: number }>(`
      UPDATE effect_logs SET status = 'running' WHERE id = @id
    `);
    stmt.run({ id });
  }

  /**
   * Effect 완료 처리
   */
  complete(id: number, result: unknown): void {
    const now = Date.now();

    const stmt = this.db.prepare<{ id: number; result: string; executed_at: number }>(`
      UPDATE effect_logs
      SET status = 'completed', result = @result, executed_at = @executed_at
      WHERE id = @id
    `);

    stmt.run({
      id,
      result: JSON.stringify(result),
      executed_at: now,
    });
  }

  /**
   * Effect 실패 처리
   */
  fail(id: number, error: string): void {
    const now = Date.now();

    const stmt = this.db.prepare<{ id: number; error: string; executed_at: number }>(`
      UPDATE effect_logs
      SET status = 'failed', error = @error, executed_at = @executed_at
      WHERE id = @id
    `);

    stmt.run({ id, error, executed_at: now });
  }

  /**
   * ID로 조회
   */
  getById(id: number): StoredEffectLog | null {
    const stmt = this.db.prepare<{ id: number }>(`
      SELECT * FROM effect_logs WHERE id = @id
    `);

    const row = stmt.get({ id }) as EffectLogRecord | undefined;
    return row ? this.toEffectLog(row) : null;
  }

  /**
   * 세션의 모든 Effect 로그 조회
   */
  getBySession(sessionId: string, limit = 1000): StoredEffectLog[] {
    const stmt = this.db.prepare<{ session_id: string; limit: number }>(`
      SELECT * FROM effect_logs
      WHERE session_id = @session_id
      ORDER BY created_at ASC
      LIMIT @limit
    `);

    const rows = stmt.all({ session_id: sessionId, limit }) as EffectLogRecord[];
    return rows.map(row => this.toEffectLog(row));
  }

  /**
   * 도메인별 Effect 로그 조회
   */
  getByDomain(sessionId: string, domain: string, limit = 1000): StoredEffectLog[] {
    const stmt = this.db.prepare<{ session_id: string; domain: string; limit: number }>(`
      SELECT * FROM effect_logs
      WHERE session_id = @session_id AND domain = @domain
      ORDER BY created_at ASC
      LIMIT @limit
    `);

    const rows = stmt.all({ session_id: sessionId, domain, limit }) as EffectLogRecord[];
    return rows.map(row => this.toEffectLog(row));
  }

  /**
   * 상태별 Effect 로그 조회
   */
  getByStatus(sessionId: string, status: EffectLogStatus): StoredEffectLog[] {
    const stmt = this.db.prepare<{ session_id: string; status: string }>(`
      SELECT * FROM effect_logs
      WHERE session_id = @session_id AND status = @status
      ORDER BY created_at ASC
    `);

    const rows = stmt.all({ session_id: sessionId, status }) as EffectLogRecord[];
    return rows.map(row => this.toEffectLog(row));
  }

  /**
   * 대기 중인 Effect 조회
   */
  getPending(sessionId: string): StoredEffectLog[] {
    return this.getByStatus(sessionId, 'pending');
  }

  /**
   * 실패한 Effect 조회
   */
  getFailed(sessionId: string): StoredEffectLog[] {
    return this.getByStatus(sessionId, 'failed');
  }

  /**
   * Effect 개수 조회
   */
  count(sessionId: string): { total: number; pending: number; completed: number; failed: number } {
    const stmt = this.db.prepare<{ session_id: string }>(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM effect_logs
      WHERE session_id = @session_id
    `);

    const result = stmt.get({ session_id: sessionId }) as {
      total: number;
      pending: number;
      completed: number;
      failed: number;
    };

    return result;
  }

  /**
   * 세션의 모든 Effect 로그 삭제
   */
  deleteBySession(sessionId: string): number {
    const stmt = this.db.prepare<{ session_id: string }>(`
      DELETE FROM effect_logs WHERE session_id = @session_id
    `);

    const result = stmt.run({ session_id: sessionId });
    return result.changes;
  }

  /**
   * 레코드를 StoredEffectLog 객체로 변환
   */
  private toEffectLog(record: EffectLogRecord): StoredEffectLog {
    return {
      id: record.id,
      sessionId: record.session_id,
      domain: record.domain,
      effectType: record.effect_type,
      effectData: JSON.parse(record.effect_data),
      status: record.status,
      result: record.result ? JSON.parse(record.result) : null,
      error: record.error,
      createdAt: new Date(record.created_at),
      executedAt: record.executed_at ? new Date(record.executed_at) : null,
    };
  }
}
