import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MigrationDatabase, createDatabase, createStorage } from '../../src/storage/index.js';

describe('Storage', () => {
  let tempDir: string;
  let db: MigrationDatabase;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'react-migrate-test-'));
    db = createDatabase(tempDir);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('MigrationDatabase', () => {
    it('should create database file', () => {
      expect(db.getPath()).toContain('.manifesto/migrate.db');
    });

    it('should initialize schema', () => {
      // Schema should be created, verify by querying
      const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'");
      const tables = stmt.all() as { name: string }[];
      const tableNames = tables.map(t => t.name);

      expect(tableNames).toContain('sessions');
      expect(tableNames).toContain('snapshots');
      expect(tableNames).toContain('effect_logs');
      expect(tableNames).toContain('file_analyses');
    });
  });

  describe('SessionRepository', () => {
    it('should create session', () => {
      const storage = createStorage(db);
      const session = storage.sessions.create({
        rootDir: '/test/path',
        outputDir: '/test/output',
        config: { verbose: true },
      });

      expect(session.id).toBeDefined();
      expect(session.rootDir).toBe('/test/path');
      expect(session.status).toBe('active');
    });

    it('should get session by id', () => {
      const storage = createStorage(db);
      const created = storage.sessions.create({
        rootDir: '/test/path',
        outputDir: '/test/output',
        config: {},
      });

      const found = storage.sessions.getById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('should update session status', () => {
      const storage = createStorage(db);
      const session = storage.sessions.create({
        rootDir: '/test/path',
        outputDir: '/test/output',
        config: {},
      });

      storage.sessions.complete(session.id);
      const updated = storage.sessions.getById(session.id);

      expect(updated?.status).toBe('completed');
    });

    it('should get active session by root dir', () => {
      const storage = createStorage(db);
      storage.sessions.create({
        rootDir: '/test/path',
        outputDir: '/test/output',
        config: {},
      });

      const found = storage.sessions.getActiveByRootDir('/test/path');

      expect(found).not.toBeNull();
      expect(found?.rootDir).toBe('/test/path');
    });
  });

  describe('SnapshotRepository', () => {
    it('should save and retrieve snapshot', () => {
      const storage = createStorage(db);
      const session = storage.sessions.create({
        rootDir: '/test',
        outputDir: '/test/out',
        config: {},
      });

      const saved = storage.snapshots.save(session.id, 'orchestrator', {
        data: { phase: 'ANALYZING' },
        state: { meta: { attempts: 1 } },
        derived: { confidence: 0.5 },
      });

      expect(saved.version).toBe(1);

      const latest = storage.snapshots.getLatest(session.id, 'orchestrator');
      expect(latest?.data).toEqual({ phase: 'ANALYZING' });
    });

    it('should increment version on subsequent saves', () => {
      const storage = createStorage(db);
      const session = storage.sessions.create({
        rootDir: '/test',
        outputDir: '/test/out',
        config: {},
      });

      storage.snapshots.save(session.id, 'orchestrator', {
        data: { v: 1 },
        state: {},
        derived: {},
      });

      const second = storage.snapshots.save(session.id, 'orchestrator', {
        data: { v: 2 },
        state: {},
        derived: {},
      });

      expect(second.version).toBe(2);
    });

    it('should get snapshot history', () => {
      const storage = createStorage(db);
      const session = storage.sessions.create({
        rootDir: '/test',
        outputDir: '/test/out',
        config: {},
      });

      for (let i = 0; i < 5; i++) {
        storage.snapshots.save(session.id, 'orchestrator', {
          data: { iteration: i },
          state: {},
          derived: {},
        });
      }

      const history = storage.snapshots.getHistory(session.id, 'orchestrator');
      expect(history).toHaveLength(5);
      // Should be sorted by version DESC
      expect(history[0]?.version).toBe(5);
    });
  });

  describe('EffectLogRepository', () => {
    it('should create effect log', () => {
      const storage = createStorage(db);
      const session = storage.sessions.create({
        rootDir: '/test',
        outputDir: '/test/out',
        config: {},
      });

      const log = storage.effectLogs.create(session.id, {
        domain: 'orchestrator',
        effectType: 'startAnalysis',
        effectData: { rootDir: '/test' },
      });

      expect(log.id).toBeGreaterThan(0);
      expect(log.status).toBe('pending');
    });

    it('should track effect completion', () => {
      const storage = createStorage(db);
      const session = storage.sessions.create({
        rootDir: '/test',
        outputDir: '/test/out',
        config: {},
      });

      const log = storage.effectLogs.create(session.id, {
        domain: 'orchestrator',
        effectType: 'test',
        effectData: {},
      });

      storage.effectLogs.complete(log.id, { success: true });
      const updated = storage.effectLogs.getById(log.id);

      expect(updated?.status).toBe('completed');
      expect(updated?.result).toEqual({ success: true });
    });

    it('should count effects by status', () => {
      const storage = createStorage(db);
      const session = storage.sessions.create({
        rootDir: '/test',
        outputDir: '/test/out',
        config: {},
      });

      const log1 = storage.effectLogs.create(session.id, {
        domain: 'orchestrator',
        effectType: 'test1',
        effectData: {},
      });
      const log2 = storage.effectLogs.create(session.id, {
        domain: 'orchestrator',
        effectType: 'test2',
        effectData: {},
      });

      storage.effectLogs.complete(log1.id, {});
      storage.effectLogs.fail(log2.id, 'Error');

      const counts = storage.effectLogs.count(session.id);
      expect(counts.total).toBe(2);
      expect(counts.completed).toBe(1);
      expect(counts.failed).toBe(1);
    });
  });
});
