import { ok, err, type Result, estimateTokens } from '@manifesto-ai/core';
import type { ILLMClient } from '../llm/types.js';
import type {
  Chunk,
  SummaryResult,
  SummarizerConfig,
  SummarizerError,
  SummaryNode,
} from './types.js';
import { DEFAULT_SUMMARIZER_CONFIG } from './types.js';

/**
 * 요약 응답 스키마 (JSON)
 */
type SummaryResponse = {
  summary: string;
  keywords: string[];
};

/**
 * 단일 청크 요약
 *
 * @param chunk - 요약할 청크
 * @param llm - LLM 클라이언트
 * @param config - 요약 설정
 * @returns 요약 결과
 */
export async function summarizeChunk(
  chunk: Chunk,
  llm: ILLMClient,
  config: Partial<SummarizerConfig> = {}
): Promise<Result<SummaryResult, SummarizerError>> {
  const fullConfig: SummarizerConfig = {
    ...DEFAULT_SUMMARIZER_CONFIG,
    ...config,
  };

  if (!chunk.text || chunk.text.trim().length === 0) {
    return err({
      code: 'EMPTY_INPUT',
      message: 'Chunk text is empty',
    });
  }

  const prompt = buildSummarizePrompt(chunk.text, fullConfig);

  const response = await llm.call({
    messages: [
      {
        role: 'system',
        content:
          'You are a precise summarizer. Extract the key information and respond in JSON format with "summary" and "keywords" fields. The summary should be concise but capture all essential points. Keywords should be 3-7 important terms.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3, // 낮은 온도로 일관성 유지
    responseFormat: 'json',
  });

  if (!response.ok) {
    return err({
      code: 'LLM_ERROR',
      message: response.error.message,
      cause: response.error,
    });
  }

  try {
    const parsed = JSON.parse(response.value.content) as SummaryResponse;

    const summaryTokens = estimateTokens(parsed.summary);
    const compressionRatio = chunk.tokenCount / Math.max(summaryTokens, 1);

    return ok({
      summary: parsed.summary,
      keywords: parsed.keywords || [],
      tokenCount: summaryTokens,
      compressionRatio,
    });
  } catch (error) {
    return err({
      code: 'PARSE_ERROR',
      message: 'Failed to parse LLM response as JSON',
      cause: error,
    });
  }
}

/**
 * 여러 요약을 상위 요약으로 통합
 *
 * @param summaries - 통합할 요약들
 * @param llm - LLM 클라이언트
 * @param config - 요약 설정
 * @returns 통합된 요약 결과
 */
export async function summarizeGroup(
  summaries: SummaryResult[],
  llm: ILLMClient,
  config: Partial<SummarizerConfig> = {}
): Promise<Result<SummaryResult, SummarizerError>> {
  const fullConfig: SummarizerConfig = {
    ...DEFAULT_SUMMARIZER_CONFIG,
    ...config,
  };

  if (summaries.length === 0) {
    return err({
      code: 'EMPTY_INPUT',
      message: 'No summaries to merge',
    });
  }

  // 단일 요약이면 그대로 반환
  if (summaries.length === 1) {
    return ok(summaries[0]!);
  }

  const combinedText = summaries.map((s) => s.summary).join('\n\n---\n\n');
  const combinedTokens = summaries.reduce((sum, s) => sum + s.tokenCount, 0);
  const allKeywords = [...new Set(summaries.flatMap((s) => s.keywords))];

  const prompt = buildMergePrompt(combinedText, allKeywords, fullConfig);

  const response = await llm.call({
    messages: [
      {
        role: 'system',
        content:
          'You are a precise summarizer. Merge multiple summaries into a coherent, comprehensive summary. Respond in JSON format with "summary" and "keywords" fields. Preserve the most important information and select the most relevant keywords.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    responseFormat: 'json',
  });

  if (!response.ok) {
    return err({
      code: 'LLM_ERROR',
      message: response.error.message,
      cause: response.error,
    });
  }

  try {
    const parsed = JSON.parse(response.value.content) as SummaryResponse;

    const summaryTokens = estimateTokens(parsed.summary);
    const compressionRatio = combinedTokens / Math.max(summaryTokens, 1);

    return ok({
      summary: parsed.summary,
      keywords: parsed.keywords || [],
      tokenCount: summaryTokens,
      compressionRatio,
    });
  } catch (error) {
    return err({
      code: 'PARSE_ERROR',
      message: 'Failed to parse LLM response as JSON',
      cause: error,
    });
  }
}

/**
 * 계층적 요약 생성 (Bottom-up)
 *
 * 청크들을 그룹으로 묶어 요약하고, 그 요약들을 다시 묶어
 * 최종 루트 요약까지 계층적으로 생성합니다.
 *
 * @param chunks - 원본 청크들
 * @param llm - LLM 클라이언트
 * @param config - 요약 설정
 * @returns 루트 요약 노드
 */
export async function hierarchicalSummarize(
  chunks: Chunk[],
  llm: ILLMClient,
  config: Partial<SummarizerConfig> = {}
): Promise<Result<SummaryNode, SummarizerError>> {
  const fullConfig: SummarizerConfig = {
    ...DEFAULT_SUMMARIZER_CONFIG,
    ...config,
  };

  if (chunks.length === 0) {
    return err({
      code: 'EMPTY_INPUT',
      message: 'No chunks to summarize',
    });
  }

  // 1단계: 각 청크를 리프 노드로 변환
  const leafNodes: SummaryNode[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const result = await summarizeChunk(chunk, llm, fullConfig);

    if (!result.ok) {
      return err(result.error);
    }

    leafNodes.push({
      id: `leaf-${i}`,
      path: `chunk.${i}`,
      depth: 0,
      summary: result.value.summary,
      originalText: chunk.text,
      tokenCount: result.value.tokenCount,
      originalTokenCount: chunk.tokenCount,
      compressionRatio: result.value.compressionRatio,
      keywords: result.value.keywords,
      children: [],
      parentId: null,
    });
  }

  // 단일 청크면 루트로 반환
  if (leafNodes.length === 1) {
    return ok(leafNodes[0]!);
  }

  // 2단계: 계층적으로 그룹화하여 요약
  let currentLevel = leafNodes;
  let depth = 1;

  while (currentLevel.length > 1) {
    const nextLevel: SummaryNode[] = [];
    const groups = groupNodes(currentLevel, fullConfig.groupSize);

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]!;

      // 단일 노드 그룹은 그대로 올림
      if (group.length === 1) {
        nextLevel.push(group[0]!);
        continue;
      }

      const groupSummaries: SummaryResult[] = group.map((node) => ({
        summary: node.summary,
        keywords: node.keywords,
        tokenCount: node.tokenCount,
        compressionRatio: node.compressionRatio,
      }));

      const mergeResult = await summarizeGroup(groupSummaries, llm, fullConfig);

      if (!mergeResult.ok) {
        return err(mergeResult.error);
      }

      const parentId = `node-${depth}-${i}`;

      // 자식 노드들의 parentId 업데이트
      for (const child of group) {
        child.parentId = parentId;
      }

      const totalOriginalTokens = group.reduce((sum, n) => sum + n.originalTokenCount, 0);

      nextLevel.push({
        id: parentId,
        path: `level.${depth}.${i}`,
        depth,
        summary: mergeResult.value.summary,
        tokenCount: mergeResult.value.tokenCount,
        originalTokenCount: totalOriginalTokens,
        compressionRatio: totalOriginalTokens / Math.max(mergeResult.value.tokenCount, 1),
        keywords: mergeResult.value.keywords,
        children: group,
        parentId: null,
      });
    }

    currentLevel = nextLevel;
    depth++;

    // 안전장치: 너무 깊어지면 중단
    if (depth > 10) {
      break;
    }
  }

  // 루트 노드 반환
  const root = currentLevel[0]!;
  root.path = 'root';

  return ok(root);
}

/**
 * 요약 프롬프트 생성
 */
function buildSummarizePrompt(text: string, config: SummarizerConfig): string {
  const maxTokens = config.maxSummaryTokens;
  const ratio = config.targetCompressionRatio;

  return `Summarize the following text concisely (target: ~${maxTokens} tokens, compression ratio: ${ratio}:1).

TEXT:
${text}

Respond in JSON format:
{
  "summary": "your concise summary here",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;
}

/**
 * 병합 프롬프트 생성
 */
function buildMergePrompt(
  combinedText: string,
  keywords: string[],
  config: SummarizerConfig
): string {
  const maxTokens = config.maxSummaryTokens;

  return `Merge the following summaries into a single coherent summary (target: ~${maxTokens} tokens).

SUMMARIES:
${combinedText}

EXISTING KEYWORDS: ${keywords.slice(0, 20).join(', ')}

Respond in JSON format:
{
  "summary": "your merged summary here",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;
}

/**
 * 노드들을 그룹으로 분할
 */
function groupNodes(nodes: SummaryNode[], groupSize: number): SummaryNode[][] {
  const groups: SummaryNode[][] = [];

  for (let i = 0; i < nodes.length; i += groupSize) {
    groups.push(nodes.slice(i, i + groupSize));
  }

  return groups;
}
