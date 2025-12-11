/**
 * CQE Embedding Providers
 *
 * 텍스트 임베딩을 생성하는 제공자 인터페이스 및 구현
 * - IEmbeddingProvider: 공통 인터페이스
 * - OpenAIEmbeddingProvider: OpenAI API 구현
 * - MockEmbeddingProvider: 테스트용 구현
 */

// ═══════════════════════════════════════════════════════
// IEmbeddingProvider Interface
// ═══════════════════════════════════════════════════════

/**
 * 임베딩 제공자 인터페이스
 */
export interface IEmbeddingProvider {
  /**
   * 단일 텍스트의 임베딩 벡터 생성
   * @param text - 임베딩할 텍스트
   * @returns 임베딩 벡터 (숫자 배열)
   */
  embed(text: string): Promise<number[]>;

  /**
   * 여러 텍스트의 임베딩 벡터 배치 생성
   * @param texts - 임베딩할 텍스트 배열
   * @returns 임베딩 벡터 배열
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * 임베딩 벡터 차원 수
   */
  readonly dimensions: number;
}

// ═══════════════════════════════════════════════════════
// OpenAI Embedding Provider
// ═══════════════════════════════════════════════════════

/**
 * OpenAI 임베딩 설정
 */
export type OpenAIEmbeddingConfig = {
  /** OpenAI API 키 */
  apiKey: string;
  /** 모델명 (기본: 'text-embedding-3-small') */
  model: string;
  /** 출력 차원 수 (text-embedding-3-*는 차원 지정 가능) */
  dimensions: number;
  /** 배치 크기 (기본 100) */
  batchSize: number;
  /** API 베이스 URL (선택적) */
  baseUrl?: string;
};

export const DEFAULT_OPENAI_EMBEDDING_CONFIG: Omit<
  OpenAIEmbeddingConfig,
  'apiKey'
> = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
  batchSize: 100,
};

/**
 * OpenAI 임베딩 제공자
 */
export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private readonly config: OpenAIEmbeddingConfig;

  constructor(config: OpenAIEmbeddingConfig) {
    this.config = {
      ...DEFAULT_OPENAI_EMBEDDING_CONFIG,
      ...config,
    };
  }

  get dimensions(): number {
    return this.config.dimensions;
  }

  /**
   * 단일 텍스트 임베딩
   */
  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    const result = results[0];
    if (!result) {
      throw new Error('Failed to generate embedding');
    }
    return result;
  }

  /**
   * 배치 임베딩
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const results: number[][] = [];

    // 배치 크기로 분할
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const batchResults = await this.callOpenAIAPI(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * OpenAI API 호출
   */
  private async callOpenAIAPI(texts: string[]): Promise<number[][]> {
    const baseUrl = this.config.baseUrl ?? 'https://api.openai.com/v1';
    const url = `${baseUrl}/embeddings`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts,
        dimensions: this.config.dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OpenAIEmbeddingResponse;

    // 인덱스 순서대로 정렬
    const sorted = data.data.sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  }
}

/**
 * OpenAI API 응답 타입
 */
type OpenAIEmbeddingResponse = {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
};

/**
 * OpenAI 임베딩 제공자 생성 헬퍼
 *
 * @param apiKey - OpenAI API 키
 * @param config - 추가 설정
 * @returns IEmbeddingProvider 인스턴스
 */
export function createOpenAIEmbeddingProvider(
  apiKey: string,
  config?: Partial<Omit<OpenAIEmbeddingConfig, 'apiKey'>>
): IEmbeddingProvider {
  return new OpenAIEmbeddingProvider({
    ...DEFAULT_OPENAI_EMBEDDING_CONFIG,
    ...config,
    apiKey,
  });
}

// ═══════════════════════════════════════════════════════
// Mock Embedding Provider
// ═══════════════════════════════════════════════════════

/**
 * 테스트용 Mock 임베딩 제공자
 *
 * 동일한 텍스트에 대해 일관된 벡터를 반환
 */
export class MockEmbeddingProvider implements IEmbeddingProvider {
  private readonly _dimensions: number;
  private readonly cache: Map<string, number[]> = new Map();

  constructor(dimensions: number = 1536) {
    this._dimensions = dimensions;
  }

  get dimensions(): number {
    return this._dimensions;
  }

  /**
   * 단일 텍스트 임베딩 (결정론적)
   */
  async embed(text: string): Promise<number[]> {
    // 캐시 확인
    const cached = this.cache.get(text);
    if (cached) {
      return cached;
    }

    // 텍스트 해시 기반 결정론적 벡터 생성
    const vector = this.generateDeterministicVector(text);
    this.cache.set(text, vector);
    return vector;
  }

  /**
   * 배치 임베딩
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }

  /**
   * 텍스트 기반 결정론적 벡터 생성
   */
  private generateDeterministicVector(text: string): number[] {
    // 간단한 해시 함수
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 32비트 정수로 변환
    }

    // 해시를 시드로 사용하여 결정론적 벡터 생성
    const vector: number[] = [];
    let seed = Math.abs(hash);

    for (let i = 0; i < this._dimensions; i++) {
      // 선형 합동 생성기 (LCG)
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      // -1 ~ 1 범위로 정규화
      vector.push((seed / 2147483648) - 1);
    }

    // 벡터 정규화 (단위 벡터)
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map((v) => v / magnitude);
  }
}

/**
 * Mock 임베딩 제공자 생성 헬퍼
 *
 * @param dimensions - 임베딩 차원 수 (기본 1536)
 * @returns IEmbeddingProvider 인스턴스
 */
export function createMockEmbeddingProvider(
  dimensions: number = 1536
): IEmbeddingProvider {
  return new MockEmbeddingProvider(dimensions);
}

// ═══════════════════════════════════════════════════════
// Controllable Mock Provider (테스트 시나리오용)
// ═══════════════════════════════════════════════════════

/**
 * 제어 가능한 Mock 임베딩 제공자
 *
 * 특정 텍스트 쌍에 대해 원하는 유사도를 반환하도록 설정 가능
 */
export class ControllableMockEmbeddingProvider implements IEmbeddingProvider {
  private readonly _dimensions: number;
  private readonly presetVectors: Map<string, number[]> = new Map();

  constructor(dimensions: number = 1536) {
    this._dimensions = dimensions;
  }

  get dimensions(): number {
    return this._dimensions;
  }

  /**
   * 특정 텍스트에 대한 벡터 미리 설정
   */
  setVector(text: string, vector: number[]): void {
    if (vector.length !== this._dimensions) {
      throw new Error(
        `Vector dimensions mismatch: expected ${this._dimensions}, got ${vector.length}`
      );
    }
    this.presetVectors.set(text, vector);
  }

  /**
   * 두 텍스트의 코사인 유사도가 특정 값이 되도록 벡터 설정
   */
  setCosineSimilarity(text1: string, text2: string, similarity: number): void {
    // text1 벡터 (첫 번째 요소만 1, 나머지 0)
    const v1 = Array(this._dimensions).fill(0);
    v1[0] = 1;

    // text2 벡터 (유사도에 따라 계산)
    const v2 = Array(this._dimensions).fill(0);
    v2[0] = similarity;
    // 나머지 차원에서 직교 성분 추가
    if (similarity < 1) {
      v2[1] = Math.sqrt(1 - similarity * similarity);
    }

    this.presetVectors.set(text1, v1);
    this.presetVectors.set(text2, v2);
  }

  async embed(text: string): Promise<number[]> {
    const preset = this.presetVectors.get(text);
    if (preset) {
      return preset;
    }

    // 기본: 랜덤 단위 벡터
    return this.generateRandomUnitVector();
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }

  private generateRandomUnitVector(): number[] {
    const vector = Array(this._dimensions)
      .fill(0)
      .map(() => Math.random() * 2 - 1);
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map((v) => v / magnitude);
  }
}

/**
 * 제어 가능한 Mock 임베딩 제공자 생성 헬퍼
 */
export function createControllableMockEmbeddingProvider(
  dimensions: number = 1536
): ControllableMockEmbeddingProvider {
  return new ControllableMockEmbeddingProvider(dimensions);
}
