import type { Storage } from '../storage/index.js';
import type { LLMProvider } from '../llm/types.js';
import type { FileAnalysis } from '../parser/types.js';

/**
 * Effect Handler 설정
 */
export interface EffectHandlerConfig {
  storage: Storage;
  llmProvider: LLMProvider;
  sessionId: string;
  rootDir: string;
  outputDir: string;
}

/**
 * Effect 결과
 */
export interface EffectResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Effect Handler 인터페이스
 *
 * 제네릭 타입으로 다양한 도메인(Orchestrator, Analyzer, Summarizer, Transformer)을 지원
 */
export interface EffectHandlers {
  /**
   * 파일 스캔 Effect
   */
  scanFiles(): Promise<EffectResult<{ count: number; files: string[] }>>;

  /**
   * 파일 분석 Effect
   * 전체 FileAnalysis 객체를 반환
   */
  analyzeFile(path: string): Promise<EffectResult<FileAnalysis>>;

  /**
   * LLM 호출 Effect
   */
  llmCall(prompt: string, context?: unknown): Promise<EffectResult<string>>;

  /**
   * 스냅샷 저장 Effect
   * 제네릭하게 모든 도메인 데이터/상태를 지원
   */
  saveSnapshot<TData = unknown, TState = unknown>(
    domain: string,
    data: TData,
    state: TState
  ): Promise<EffectResult<{ version: number }>>;

  /**
   * 스냅샷 로드 Effect
   * 제네릭하게 모든 도메인 데이터/상태를 지원
   */
  loadSnapshot<TData = unknown, TState = unknown>(
    domain: string
  ): Promise<EffectResult<{ data: TData; state: TState } | null>>;

  /**
   * Effect 로그 기록
   * payload를 unknown으로 받아 다양한 이벤트 페이로드 지원
   */
  logEffect(effectType: string, effectData: unknown): Promise<EffectResult<{ id: number }>>;

  /**
   * 도메인 파일 출력 Effect
   */
  writeDomainFile(
    name: string,
    content: unknown
  ): Promise<EffectResult<{ path: string }>>;

  /**
   * 파일 읽기 Effect
   */
  readFile(path: string): Promise<EffectResult<string>>;

  /**
   * 파일 쓰기 Effect
   */
  writeFile(path: string, content: string): Promise<EffectResult<{ path: string }>>;

  /**
   * 파일 삭제 Effect
   */
  deleteFile(path: string): Promise<EffectResult<void>>;
}

/**
 * Effect Handlers 생성
 */
export function createEffectHandlers(config: EffectHandlerConfig): EffectHandlers {
  const { storage, llmProvider, sessionId, rootDir, outputDir } = config;

  return {
    async scanFiles() {
      try {
        const { scanFiles: scan } = await import('../parser/file-scanner.js');
        const files = await scan({ rootDir });
        return {
          success: true,
          data: {
            count: files.length,
            files: files.map(f => f.relativePath),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async analyzeFile(path: string) {
      try {
        const { analyzeFile: analyze } = await import('../parser/index.js');
        const { readFile } = await import('fs/promises');
        const content = await readFile(path, 'utf-8');
        const analysis = analyze({
          path,
          relativePath: path.replace(rootDir, '').replace(/^\//, ''),
          extension: path.split('.').pop() ?? '',
          content,
          size: content.length,
        });
        return {
          success: true,
          data: analysis,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async llmCall(prompt: string, context?: unknown) {
      try {
        const result = await llmProvider.complete([
          { role: 'system', content: 'You are a React code analyzer helping migrate code to Manifesto schema.' },
          { role: 'user', content: context ? `Context: ${JSON.stringify(context)}\n\n${prompt}` : prompt },
        ]);
        return {
          success: true,
          data: result.content,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async saveSnapshot<TData, TState>(domain: string, data: TData, state: TState) {
      try {
        const snapshot = storage.snapshots.save(sessionId, domain, {
          data,
          state,
          derived: {}, // 각 도메인별 derived는 런타임에서 계산
        });
        return {
          success: true,
          data: { version: snapshot.version },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async loadSnapshot<TData, TState>(domain: string) {
      try {
        const snapshot = storage.snapshots.getLatest<TData, TState>(
          sessionId,
          domain
        );
        if (!snapshot) {
          return { success: true, data: null };
        }
        return {
          success: true,
          data: {
            data: snapshot.data,
            state: snapshot.state,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async logEffect(effectType: string, effectData: unknown) {
      try {
        // effectData를 Record<string, unknown>으로 캐스팅
        // 이벤트 페이로드를 직렬화 가능한 형태로 변환
        const data = (effectData && typeof effectData === 'object' ? effectData : { value: effectData }) as Record<string, unknown>;
        const log = storage.effectLogs.create(sessionId, {
          domain: effectType.split(':')[0] ?? 'unknown',
          effectType,
          effectData: data,
        });
        return {
          success: true,
          data: { id: log.id },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async writeDomainFile(name: string, content: unknown) {
      try {
        const { writeFile, mkdir } = await import('fs/promises');
        const { join, dirname } = await import('path');

        const filePath = join(outputDir, `${name}.domain.json`);
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');

        return {
          success: true,
          data: { path: filePath },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async readFile(path: string) {
      try {
        const { readFile: read } = await import('fs/promises');
        const content = await read(path, 'utf-8');
        return {
          success: true,
          data: content,
        };
      } catch (error) {
        // 파일이 없으면 success: true, data: undefined 반환
        const e = error as NodeJS.ErrnoException;
        if (e.code === 'ENOENT') {
          return {
            success: true,
            data: undefined,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async writeFile(path: string, content: string) {
      try {
        const { writeFile: write, mkdir } = await import('fs/promises');
        const { dirname } = await import('path');

        await mkdir(dirname(path), { recursive: true });
        await write(path, content, 'utf-8');

        return {
          success: true,
          data: { path },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async deleteFile(path: string) {
      try {
        const { unlink } = await import('fs/promises');
        await unlink(path);
        return {
          success: true,
        };
      } catch (error) {
        // 파일이 없으면 성공으로 처리
        const e = error as NodeJS.ErrnoException;
        if (e.code === 'ENOENT') {
          return {
            success: true,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
