import { Ollama } from 'ollama';
import { BaseLLMProvider } from '../provider.js';
import type {
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMProviderConfig,
} from '../types.js';
import { LLMError, ModelNotFoundError } from '../types.js';

/**
 * Ollama Provider (로컬 LLM)
 */
export class OllamaProvider extends BaseLLMProvider {
  readonly name = 'ollama';
  readonly defaultModel = 'llama3.2';

  private client: Ollama;

  constructor(config: LLMProviderConfig) {
    super(config);

    this.client = new Ollama({
      host: config.baseUrl ?? 'http://localhost:11434',
    });
  }

  async complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const startTime = performance.now();
    const model = this.resolveModel(options);

    try {
      const response = await this.client.chat({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens,
          stop: options?.stopSequences,
        },
        format: options?.responseFormat === 'json' ? 'json' : undefined,
      });

      return {
        content: response.message.content,
        model: response.model,
        usage: {
          promptTokens: response.prompt_eval_count ?? 0,
          completionTokens: response.eval_count ?? 0,
          totalTokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
        },
        finishReason: response.done ? 'stop' : 'error',
        responseTime: performance.now() - startTime,
      };
    } catch (error) {
      throw this.handleError(error, model);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 사용 가능한 모델 목록 조회
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.list();
      return response.models.map(m => m.name);
    } catch {
      return [];
    }
  }

  /**
   * 모델 Pull (다운로드)
   */
  async pullModel(modelName: string): Promise<void> {
    await this.client.pull({ model: modelName });
  }

  private handleError(error: unknown, model: string): LLMError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('not found') || message.includes('does not exist')) {
        return new ModelNotFoundError('ollama', model);
      }

      if (message.includes('connection refused') || message.includes('econnrefused')) {
        return new LLMError(
          'Ollama server is not running. Start it with: ollama serve',
          'CONNECTION_ERROR',
          'ollama',
          true,
          error
        );
      }

      return new LLMError(error.message, 'UNKNOWN', 'ollama', true, error);
    }

    return new LLMError(String(error), 'UNKNOWN', 'ollama', true);
  }
}
