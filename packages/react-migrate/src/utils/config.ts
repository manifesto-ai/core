import { resolve } from 'path';
import type { LLMProviderType } from '../llm/types.js';

/**
 * CLI 설정
 */
export interface CLIConfig {
  /** 분석할 루트 디렉토리 */
  rootDir: string;
  /** 출력 디렉토리 */
  outputDir: string;
  /** 이전 세션 재개 */
  resume: boolean;
  /** 자동 모드 (HITL 최소화) */
  auto: boolean;
  /** 드라이런 (파일 생성 안 함) */
  dryRun: boolean;
  /** 상세 로깅 */
  verbose: boolean;
  /** LLM Provider */
  provider: LLMProviderType;
  /** LLM 모델 */
  model: string;
  /** 데이터베이스 경로 (옵션) */
  dbPath?: string;
}

/**
 * CLI 플래그 (meow에서 받은 원시 플래그)
 */
export interface CLIFlags {
  root?: string;
  output?: string;
  resume?: boolean;
  auto?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  provider?: string;
  model?: string;
  dbPath?: string;
}

/**
 * 기본 설정
 */
const DEFAULT_CONFIG: CLIConfig = {
  rootDir: process.cwd(),
  outputDir: './manifesto',
  resume: false,
  auto: false,
  dryRun: false,
  verbose: false,
  provider: 'openai',
  model: 'gpt-4o-mini',
};

/**
 * CLI 플래그를 설정으로 변환
 */
export function loadConfig(flags: CLIFlags): CLIConfig {
  const rootDir = resolve(flags.root ?? DEFAULT_CONFIG.rootDir);
  const outputDir = resolve(rootDir, flags.output ?? DEFAULT_CONFIG.outputDir);

  return {
    rootDir,
    outputDir,
    resume: flags.resume ?? DEFAULT_CONFIG.resume,
    auto: flags.auto ?? DEFAULT_CONFIG.auto,
    dryRun: flags.dryRun ?? DEFAULT_CONFIG.dryRun,
    verbose: flags.verbose ?? DEFAULT_CONFIG.verbose,
    provider: (flags.provider as LLMProviderType) ?? DEFAULT_CONFIG.provider,
    model: flags.model ?? DEFAULT_CONFIG.model,
    dbPath: flags.dbPath,
  };
}

/**
 * 설정 검증
 */
export function validateConfig(config: CLIConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // rootDir 존재 확인은 런타임에서 처리

  // provider 검증
  const validProviders: LLMProviderType[] = ['openai', 'anthropic', 'ollama', 'mock'];
  if (!validProviders.includes(config.provider)) {
    errors.push(`Invalid provider: ${config.provider}. Valid options: ${validProviders.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 설정을 JSON으로 직렬화 (저장용)
 */
export function serializeConfig(config: CLIConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * JSON에서 설정 역직렬화
 */
export function deserializeConfig(json: string): CLIConfig {
  return JSON.parse(json) as CLIConfig;
}
