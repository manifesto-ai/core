import { estimateTokens } from '@manifesto-ai/core';
import type { Chunk, ChunkResult, ChunkingConfig } from './types.js';
import { DEFAULT_CHUNKING_CONFIG } from './types.js';

/**
 * 고유 ID 생성
 */
function generateChunkId(index: number): string {
  return `chunk-${index}-${Date.now().toString(36)}`;
}

/**
 * 텍스트를 청크로 분할
 *
 * @param text - 분할할 텍스트
 * @param config - 청킹 설정 (부분 적용 가능)
 * @returns 청킹 결과
 */
export function chunkText(
  text: string,
  config: Partial<ChunkingConfig> = {}
): ChunkResult {
  const fullConfig: ChunkingConfig = {
    ...DEFAULT_CHUNKING_CONFIG,
    ...config,
  };

  if (!text || text.trim().length === 0) {
    return {
      chunks: [],
      totalTokens: 0,
      strategy: fullConfig.strategy,
    };
  }

  let chunks: Chunk[];

  switch (fullConfig.strategy) {
    case 'fixed':
      chunks = fixedChunker(text, fullConfig.targetChunkTokens, fullConfig.overlapTokens);
      break;
    case 'semantic':
      chunks = semanticChunker(text, fullConfig.maxChunkTokens);
      break;
    case 'adaptive':
      chunks = adaptiveChunker(text, fullConfig);
      break;
    default:
      chunks = semanticChunker(text, fullConfig.maxChunkTokens);
  }

  const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

  return {
    chunks,
    totalTokens,
    strategy: fullConfig.strategy,
  };
}

/**
 * 고정 크기 청킹 (토큰 기준)
 *
 * 텍스트를 고정된 토큰 수로 분할합니다.
 * 단어 경계를 존중하여 분할합니다.
 *
 * @param text - 분할할 텍스트
 * @param targetTokens - 목표 청크 토큰 수
 * @param overlap - 청크 간 중복 토큰 수
 * @returns 청크 배열
 */
export function fixedChunker(text: string, targetTokens: number, overlap: number): Chunk[] {
  const chunks: Chunk[] = [];
  const words = text.split(/(\s+)/); // 공백도 보존

  let currentChunk = '';
  let currentTokens = 0;
  let startOffset = 0;
  let chunkIndex = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word === undefined) continue;

    const wordTokens = estimateTokens(word);

    if (currentTokens + wordTokens > targetTokens && currentChunk.length > 0) {
      // 현재 청크 저장
      chunks.push({
        id: generateChunkId(chunkIndex++),
        text: currentChunk.trim(),
        tokenCount: currentTokens,
        startOffset,
        endOffset: startOffset + currentChunk.length,
      });

      // 오버랩 처리: 마지막 몇 단어를 다음 청크로 이월
      if (overlap > 0) {
        const overlapResult = extractOverlap(currentChunk, overlap);
        startOffset = startOffset + currentChunk.length - overlapResult.text.length;
        currentChunk = overlapResult.text;
        currentTokens = overlapResult.tokens;
      } else {
        startOffset += currentChunk.length;
        currentChunk = '';
        currentTokens = 0;
      }
    }

    currentChunk += word;
    currentTokens += wordTokens;
  }

  // 마지막 청크 저장
  if (currentChunk.trim().length > 0) {
    chunks.push({
      id: generateChunkId(chunkIndex),
      text: currentChunk.trim(),
      tokenCount: currentTokens,
      startOffset,
      endOffset: startOffset + currentChunk.length,
    });
  }

  return chunks;
}

/**
 * 오버랩 텍스트 추출
 */
function extractOverlap(text: string, targetTokens: number): { text: string; tokens: number } {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  let overlapText = '';
  let overlapTokens = 0;

  // 뒤에서부터 단어를 추가
  for (let i = words.length - 1; i >= 0 && overlapTokens < targetTokens; i--) {
    const word = words[i];
    if (word === undefined) continue;

    const wordTokens = estimateTokens(word);
    overlapText = word + (overlapText ? ' ' + overlapText : '');
    overlapTokens += wordTokens;
  }

  return { text: overlapText, tokens: overlapTokens };
}

/**
 * 의미 기반 청킹 (문단/섹션 경계)
 *
 * 문단 경계를 기준으로 분할하며, 최대 토큰 수를 초과하면 추가 분할합니다.
 *
 * @param text - 분할할 텍스트
 * @param maxTokens - 최대 청크 토큰 수
 * @returns 청크 배열
 */
export function semanticChunker(text: string, maxTokens: number): Chunk[] {
  const chunks: Chunk[] = [];

  // 문단 경계 분리 (빈 줄 기준)
  const paragraphs = text.split(/\n\s*\n/);

  let currentChunk = '';
  let currentTokens = 0;
  let startOffset = 0;
  let chunkIndex = 0;
  let currentOffset = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    if (paragraph === undefined) continue;

    const trimmedParagraph = paragraph.trim();
    if (trimmedParagraph.length === 0) {
      currentOffset += paragraph.length + 2; // +2 for \n\n
      continue;
    }

    const paragraphTokens = estimateTokens(trimmedParagraph);

    // 단일 문단이 최대 토큰을 초과하면 문장 단위로 분할
    if (paragraphTokens > maxTokens) {
      // 현재 청크가 있으면 먼저 저장
      if (currentChunk.trim().length > 0) {
        chunks.push({
          id: generateChunkId(chunkIndex++),
          text: currentChunk.trim(),
          tokenCount: currentTokens,
          startOffset,
          endOffset: currentOffset,
        });
        currentChunk = '';
        currentTokens = 0;
        startOffset = currentOffset;
      }

      // 문장 단위로 분할
      const sentenceChunks = splitBySentences(
        trimmedParagraph,
        maxTokens,
        currentOffset,
        chunkIndex
      );
      chunks.push(...sentenceChunks);
      chunkIndex += sentenceChunks.length;
      currentOffset += paragraph.length + 2;
      startOffset = currentOffset;
      continue;
    }

    // 현재 청크에 추가하면 초과하는 경우
    if (currentTokens + paragraphTokens > maxTokens && currentChunk.length > 0) {
      chunks.push({
        id: generateChunkId(chunkIndex++),
        text: currentChunk.trim(),
        tokenCount: currentTokens,
        startOffset,
        endOffset: currentOffset,
      });
      currentChunk = '';
      currentTokens = 0;
      startOffset = currentOffset;
    }

    // 문단 추가
    if (currentChunk.length > 0) {
      currentChunk += '\n\n';
    }
    currentChunk += trimmedParagraph;
    currentTokens += paragraphTokens;
    currentOffset += paragraph.length + 2;
  }

  // 마지막 청크 저장
  if (currentChunk.trim().length > 0) {
    chunks.push({
      id: generateChunkId(chunkIndex),
      text: currentChunk.trim(),
      tokenCount: currentTokens,
      startOffset,
      endOffset: text.length,
    });
  }

  return chunks;
}

/**
 * 문장 단위로 분할
 */
function splitBySentences(
  text: string,
  maxTokens: number,
  baseOffset: number,
  startIndex: number
): Chunk[] {
  const chunks: Chunk[] = [];

  // 문장 분리 (마침표, 물음표, 느낌표 기준)
  // 한국어와 영어 모두 지원
  const sentences = text.split(/(?<=[.!?。！？])\s+/);

  let currentChunk = '';
  let currentTokens = 0;
  let chunkIndex = startIndex;
  let localOffset = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    if (sentence === undefined) continue;

    const sentenceTokens = estimateTokens(sentence);

    if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
      chunks.push({
        id: generateChunkId(chunkIndex++),
        text: currentChunk.trim(),
        tokenCount: currentTokens,
        startOffset: baseOffset + localOffset - currentChunk.length,
        endOffset: baseOffset + localOffset,
      });
      currentChunk = '';
      currentTokens = 0;
    }

    currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence;
    currentTokens += sentenceTokens;
    localOffset += sentence.length + 1;
  }

  // 마지막 청크 저장
  if (currentChunk.trim().length > 0) {
    chunks.push({
      id: generateChunkId(chunkIndex),
      text: currentChunk.trim(),
      tokenCount: currentTokens,
      startOffset: baseOffset + localOffset - currentChunk.length,
      endOffset: baseOffset + text.length,
    });
  }

  return chunks;
}

/**
 * 적응형 청킹 (구조 감지)
 *
 * 텍스트 구조를 감지하여 최적의 청킹 전략을 선택합니다:
 * - 마크다운 헤더가 있으면 섹션 기반 분할
 * - 코드 블록이 있으면 코드 블록 보존
 * - 그 외에는 의미 기반 분할
 *
 * @param text - 분할할 텍스트
 * @param config - 청킹 설정
 * @returns 청크 배열
 */
export function adaptiveChunker(text: string, config: ChunkingConfig): Chunk[] {
  // 마크다운 헤더 감지
  const hasMarkdownHeaders = /^#+\s/m.test(text);

  // 코드 블록 감지
  const hasCodeBlocks = /```[\s\S]*?```/m.test(text);

  if (hasMarkdownHeaders) {
    return markdownChunker(text, config.maxChunkTokens);
  }

  if (hasCodeBlocks) {
    return codeAwareChunker(text, config.maxChunkTokens);
  }

  // 기본: 의미 기반 청킹
  return semanticChunker(text, config.maxChunkTokens);
}

/**
 * 마크다운 섹션 기반 청킹
 */
function markdownChunker(text: string, maxTokens: number): Chunk[] {
  const chunks: Chunk[] = [];

  // 헤더 기준으로 분할 (# ~ ######)
  const sections = text.split(/(?=^#{1,6}\s)/m);

  let currentChunk = '';
  let currentTokens = 0;
  let startOffset = 0;
  let chunkIndex = 0;
  let currentOffset = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (section === undefined || section.trim().length === 0) {
      currentOffset += section?.length ?? 0;
      continue;
    }

    const sectionTokens = estimateTokens(section);

    // 단일 섹션이 최대 토큰 초과 시 semantic 분할
    if (sectionTokens > maxTokens) {
      if (currentChunk.trim().length > 0) {
        chunks.push({
          id: generateChunkId(chunkIndex++),
          text: currentChunk.trim(),
          tokenCount: currentTokens,
          startOffset,
          endOffset: currentOffset,
        });
        currentChunk = '';
        currentTokens = 0;
        startOffset = currentOffset;
      }

      const subChunks = semanticChunker(section, maxTokens);
      for (const subChunk of subChunks) {
        chunks.push({
          ...subChunk,
          id: generateChunkId(chunkIndex++),
          startOffset: currentOffset + subChunk.startOffset,
          endOffset: currentOffset + subChunk.endOffset,
        });
      }
      currentOffset += section.length;
      startOffset = currentOffset;
      continue;
    }

    // 현재 청크에 추가하면 초과하는 경우
    if (currentTokens + sectionTokens > maxTokens && currentChunk.length > 0) {
      chunks.push({
        id: generateChunkId(chunkIndex++),
        text: currentChunk.trim(),
        tokenCount: currentTokens,
        startOffset,
        endOffset: currentOffset,
      });
      currentChunk = '';
      currentTokens = 0;
      startOffset = currentOffset;
    }

    currentChunk += section;
    currentTokens += sectionTokens;
    currentOffset += section.length;
  }

  // 마지막 청크 저장
  if (currentChunk.trim().length > 0) {
    chunks.push({
      id: generateChunkId(chunkIndex),
      text: currentChunk.trim(),
      tokenCount: currentTokens,
      startOffset,
      endOffset: text.length,
    });
  }

  return chunks;
}

/**
 * 코드 블록 인식 청킹
 */
function codeAwareChunker(text: string, maxTokens: number): Chunk[] {
  const chunks: Chunk[] = [];

  // 코드 블록과 일반 텍스트 분리
  const parts = text.split(/(```[\s\S]*?```)/);

  let chunkIndex = 0;
  let currentOffset = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === undefined || part.length === 0) continue;

    const isCodeBlock = part.startsWith('```');
    const partTokens = estimateTokens(part);

    if (isCodeBlock) {
      // 코드 블록은 단일 청크로 유지 (가능하면)
      if (partTokens <= maxTokens) {
        chunks.push({
          id: generateChunkId(chunkIndex++),
          text: part,
          tokenCount: partTokens,
          startOffset: currentOffset,
          endOffset: currentOffset + part.length,
          metadata: { type: 'code' },
        });
      } else {
        // 코드 블록이 너무 크면 줄 단위로 분할
        const codeChunks = splitCodeBlock(part, maxTokens, currentOffset, chunkIndex);
        chunks.push(...codeChunks);
        chunkIndex += codeChunks.length;
      }
    } else {
      // 일반 텍스트는 semantic 청킹
      const textChunks = semanticChunker(part, maxTokens);
      for (const textChunk of textChunks) {
        chunks.push({
          ...textChunk,
          id: generateChunkId(chunkIndex++),
          startOffset: currentOffset + textChunk.startOffset,
          endOffset: currentOffset + textChunk.endOffset,
        });
      }
    }

    currentOffset += part.length;
  }

  return chunks;
}

/**
 * 코드 블록 줄 단위 분할
 */
function splitCodeBlock(
  code: string,
  maxTokens: number,
  baseOffset: number,
  startIndex: number
): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = code.split('\n');

  let currentChunk = '';
  let currentTokens = 0;
  let chunkIndex = startIndex;
  let localOffset = 0;

  // 코드 블록 시작/끝 마커 추출
  const startMarker = lines[0] || '```';
  const endMarker = '```';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    const lineWithNewline = line + (i < lines.length - 1 ? '\n' : '');
    const lineTokens = estimateTokens(lineWithNewline);

    if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
      // 코드 블록 형식 유지
      const chunkText =
        (i > 0 && !currentChunk.startsWith('```') ? startMarker + '\n' : '') +
        currentChunk +
        (currentChunk.endsWith('```') ? '' : '\n' + endMarker);

      chunks.push({
        id: generateChunkId(chunkIndex++),
        text: chunkText,
        tokenCount: estimateTokens(chunkText),
        startOffset: baseOffset + localOffset - currentChunk.length,
        endOffset: baseOffset + localOffset,
        metadata: { type: 'code' },
      });
      currentChunk = '';
      currentTokens = 0;
    }

    currentChunk += lineWithNewline;
    currentTokens += lineTokens;
    localOffset += lineWithNewline.length;
  }

  // 마지막 청크 저장
  if (currentChunk.trim().length > 0) {
    chunks.push({
      id: generateChunkId(chunkIndex),
      text: currentChunk,
      tokenCount: currentTokens,
      startOffset: baseOffset + localOffset - currentChunk.length,
      endOffset: baseOffset + code.length,
      metadata: { type: 'code' },
    });
  }

  return chunks;
}
