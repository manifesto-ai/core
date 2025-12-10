import type { MigrationDatabase } from '../database.js';
import type { SessionRecord, SessionStatus } from '../schema.js';
import { randomUUID } from 'crypto';

/**
 * 세션 생성 입력
 */
export interface CreateSessionInput {
  rootDir: string;
  outputDir: string;
  config: Record<string, unknown>;
}

/**
 * 세션 업데이트 입력
 */
export interface UpdateSessionInput {
  status?: SessionStatus;
  config?: Record<string, unknown>;
}

/**
 * 세션
 */
export interface Session {
  id: string;
  rootDir: string;
  outputDir: string;
  status: SessionStatus;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 세션 Repository
 */
export class SessionRepository {
  constructor(private db: MigrationDatabase) {}

  /**
   * 세션 생성
   */
  create(input: CreateSessionInput): Session {
    const id = randomUUID();
    const now = Date.now();

    const stmt = this.db.prepare<{
      id: string;
      root_dir: string;
      output_dir: string;
      status: string;
      config: string;
      created_at: number;
      updated_at: number;
    }>(`
      INSERT INTO sessions (id, root_dir, output_dir, status, config, created_at, updated_at)
      VALUES (@id, @root_dir, @output_dir, @status, @config, @created_at, @updated_at)
    `);

    stmt.run({
      id,
      root_dir: input.rootDir,
      output_dir: input.outputDir,
      status: 'active',
      config: JSON.stringify(input.config),
      created_at: now,
      updated_at: now,
    });

    return {
      id,
      rootDir: input.rootDir,
      outputDir: input.outputDir,
      status: 'active',
      config: input.config,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  /**
   * ID로 세션 조회
   */
  getById(id: string): Session | null {
    const stmt = this.db.prepare<{ id: string }>(`
      SELECT * FROM sessions WHERE id = @id
    `);

    const row = stmt.get({ id }) as SessionRecord | undefined;
    return row ? this.toSession(row) : null;
  }

  /**
   * rootDir로 활성 세션 조회
   */
  getActiveByRootDir(rootDir: string): Session | null {
    const stmt = this.db.prepare<{ root_dir: string }>(`
      SELECT * FROM sessions
      WHERE root_dir = @root_dir AND status = 'active'
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    const row = stmt.get({ root_dir: rootDir }) as SessionRecord | undefined;
    return row ? this.toSession(row) : null;
  }

  /**
   * 가장 최근 세션 조회
   */
  getLatest(): Session | null {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    const row = stmt.get() as SessionRecord | undefined;
    return row ? this.toSession(row) : null;
  }

  /**
   * 모든 세션 조회
   */
  getAll(limit = 100): Session[] {
    const stmt = this.db.prepare<{ limit: number }>(`
      SELECT * FROM sessions
      ORDER BY updated_at DESC
      LIMIT @limit
    `);

    const rows = stmt.all({ limit }) as SessionRecord[];
    return rows.map(row => this.toSession(row));
  }

  /**
   * 세션 업데이트
   */
  update(id: string, input: UpdateSessionInput): Session | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const now = Date.now();
    const updates: string[] = ['updated_at = @updated_at'];
    const params: Record<string, unknown> = { id, updated_at: now };

    if (input.status !== undefined) {
      updates.push('status = @status');
      params['status'] = input.status;
    }

    if (input.config !== undefined) {
      updates.push('config = @config');
      params['config'] = JSON.stringify(input.config);
    }

    const stmt = this.db.prepare(`
      UPDATE sessions
      SET ${updates.join(', ')}
      WHERE id = @id
    `);

    stmt.run(params);

    return this.getById(id);
  }

  /**
   * 세션 완료 처리
   */
  complete(id: string): Session | null {
    return this.update(id, { status: 'completed' });
  }

  /**
   * 세션 실패 처리
   */
  fail(id: string): Session | null {
    return this.update(id, { status: 'failed' });
  }

  /**
   * 세션 일시정지
   */
  pause(id: string): Session | null {
    return this.update(id, { status: 'paused' });
  }

  /**
   * 세션 재개
   */
  resume(id: string): Session | null {
    return this.update(id, { status: 'active' });
  }

  /**
   * 세션 삭제
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare<{ id: string }>(`
      DELETE FROM sessions WHERE id = @id
    `);

    const result = stmt.run({ id });
    return result.changes > 0;
  }

  /**
   * 레코드를 Session 객체로 변환
   */
  private toSession(record: SessionRecord): Session {
    return {
      id: record.id,
      rootDir: record.root_dir,
      outputDir: record.output_dir,
      status: record.status,
      config: JSON.parse(record.config),
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
    };
  }
}
