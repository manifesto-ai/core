import Database from 'better-sqlite3';
import { CREATE_TABLES_SQL, SCHEMA_VERSION } from './schema.js';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

/**
 * 데이터베이스 옵션
 */
export interface DatabaseOptions {
  /** 데이터베이스 파일 경로 */
  path: string;
  /** 읽기 전용 모드 */
  readonly?: boolean;
  /** 상세 로깅 */
  verbose?: boolean;
}

/**
 * 마이그레이션 데이터베이스
 */
export class MigrationDatabase {
  private db: Database.Database;
  private readonly dbPath: string;

  constructor(options: DatabaseOptions) {
    this.dbPath = options.path;

    // 디렉토리 생성
    const dir = dirname(options.path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // 데이터베이스 열기
    this.db = new Database(options.path, {
      readonly: options.readonly,
      verbose: options.verbose ? console.log : undefined,
    });

    // WAL 모드 활성화 (동시 접근 성능 향상)
    this.db.pragma('journal_mode = WAL');

    // 외래 키 제약 활성화
    this.db.pragma('foreign_keys = ON');

    // 스키마 초기화
    this.initialize();
  }

  /**
   * 스키마 초기화
   */
  private initialize(): void {
    const currentVersion = this.getSchemaVersion();

    if (currentVersion === 0) {
      // 새 데이터베이스
      this.db.exec(CREATE_TABLES_SQL);
    } else if (currentVersion < SCHEMA_VERSION) {
      // 마이그레이션 실행
      this.runMigrations(currentVersion);
    }
  }

  /**
   * 현재 스키마 버전 조회
   */
  private getSchemaVersion(): number {
    try {
      const result = this.db
        .prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
        .get() as { version: number } | undefined;
      return result?.version ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * 마이그레이션 실행
   */
  private runMigrations(fromVersion: number): void {
    // 향후 마이그레이션 구현
    console.log(`Migrating database from version ${fromVersion} to ${SCHEMA_VERSION}`);
  }

  /**
   * Statement 준비
   */
  prepare<BindParameters extends unknown[] | object = unknown[]>(
    sql: string
  ): Database.Statement<BindParameters> {
    return this.db.prepare<BindParameters>(sql);
  }

  /**
   * 트랜잭션 실행
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * SQL 직접 실행
   */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * 데이터베이스 경로 조회
   */
  getPath(): string {
    return this.dbPath;
  }

  /**
   * 데이터베이스 닫기
   */
  close(): void {
    this.db.close();
  }

  /**
   * 체크포인트 (WAL 플러시)
   */
  checkpoint(): void {
    this.db.pragma('wal_checkpoint(TRUNCATE)');
  }

  /**
   * 데이터베이스 백업
   */
  async backup(destPath: string): Promise<void> {
    await this.db.backup(destPath);
  }
}

/**
 * 기본 데이터베이스 경로
 */
export function getDefaultDatabasePath(rootDir: string): string {
  return `${rootDir}/.manifesto/migrate.db`;
}

/**
 * 데이터베이스 인스턴스 생성
 */
export function createDatabase(rootDir: string, options?: Partial<DatabaseOptions>): MigrationDatabase {
  const dbPath = options?.path ?? getDefaultDatabasePath(rootDir);
  return new MigrationDatabase({
    path: dbPath,
    readonly: options?.readonly ?? false,
    verbose: options?.verbose ?? false,
  });
}
