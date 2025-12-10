#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { App } from './App.js';
import { loadConfig, validateConfig, type CLIFlags } from '../utils/config.js';
import { createDatabase, createStorage } from '../storage/index.js';
import { createProvider, loadProviderFromEnv } from '../llm/index.js';
import { createOrchestratorRuntime } from '../runtime/orchestrator-runtime.js';

const cli = meow(`
  Usage
    $ react-migrate [options]

  Options
    --root, -r        Root directory to analyze (default: current directory)
    --output, -o      Output directory for generated files (default: ./manifesto)
    --resume          Resume previous session
    --auto            Auto mode (minimize human intervention)
    --dry-run         Preview changes without writing files
    --verbose         Enable verbose logging
    --model           LLM model to use (default: gpt-4o-mini)
    --provider        LLM provider: openai, anthropic, ollama, mock (default: openai)
    --db-path         Custom database path

  Examples
    $ react-migrate
    $ react-migrate --root ./src --output ./manifesto
    $ react-migrate --resume
    $ react-migrate --auto --provider openai

  Environment Variables
    OPENAI_API_KEY      OpenAI API key
    ANTHROPIC_API_KEY   Anthropic API key
    OLLAMA_HOST         Ollama server URL (default: http://localhost:11434)
    LLM_PROVIDER        Default LLM provider
`, {
  importMeta: import.meta,
  flags: {
    root: {
      type: 'string',
      shortFlag: 'r',
    },
    output: {
      type: 'string',
      shortFlag: 'o',
    },
    resume: {
      type: 'boolean',
      default: false,
    },
    auto: {
      type: 'boolean',
      default: false,
    },
    dryRun: {
      type: 'boolean',
      default: false,
    },
    verbose: {
      type: 'boolean',
      default: false,
    },
    model: {
      type: 'string',
    },
    provider: {
      type: 'string',
    },
    dbPath: {
      type: 'string',
    },
  },
});

async function main() {
  // 설정 로드
  const config = loadConfig(cli.flags as CLIFlags);

  // 설정 검증
  const validation = validateConfig(config);
  if (!validation.valid) {
    console.error('Configuration errors:');
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  if (config.verbose) {
    console.log('Configuration:', JSON.stringify(config, null, 2));
  }

  // 데이터베이스 초기화
  const db = createDatabase(config.rootDir, { path: config.dbPath });
  const storage = createStorage(db);

  // LLM Provider 초기화
  let llmProvider;
  try {
    const providerConfig = loadProviderFromEnv(config.provider);
    providerConfig.defaultModel = config.model;
    llmProvider = createProvider(providerConfig);
  } catch (error) {
    console.error(`Failed to initialize LLM provider: ${error instanceof Error ? error.message : error}`);
    console.error('Make sure you have set the appropriate API key environment variable.');
    process.exit(1);
  }

  // 세션 생성 또는 재개
  let session;
  if (config.resume) {
    session = storage.sessions.getActiveByRootDir(config.rootDir);
    if (!session) {
      console.log('No active session found. Starting new session...');
    }
  }

  if (!session) {
    session = storage.sessions.create({
      rootDir: config.rootDir,
      outputDir: config.outputDir,
      config: config as unknown as Record<string, unknown>,
    });
  }

  // Runtime 생성
  const runtime = createOrchestratorRuntime({
    storage,
    llmProvider,
    sessionId: session.id,
    rootDir: config.rootDir,
    outputDir: config.outputDir,
  });

  // 이전 상태 복원 시도
  if (config.resume) {
    const restored = await runtime.restore();
    if (restored && config.verbose) {
      console.log('Previous session restored.');
    }
  }

  // Ink 앱 렌더링
  const { waitUntilExit } = render(
    <App runtime={runtime} version="0.1.0" />
  );

  // 앱 종료 대기
  await waitUntilExit();

  // 정리
  db.close();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
