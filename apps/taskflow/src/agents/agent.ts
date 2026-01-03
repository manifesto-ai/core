/**
 * TaskFlow Agent
 *
 * Main agent orchestrator that coordinates intent parsing, action execution,
 * and response generation following Manifesto 1.0v patterns.
 *
 * Architecture:
 * 1. User message → Intent Parser (LLM1) → Intent
 * 2. Intent → TaskFlowApp.dispatch() → State change
 * 3. Updated Snapshot → Response Generator (LLM2) → User response
 */

import type { ActorRef } from "@manifesto-ai/world";
import type { TaskFlowApp } from "../manifesto/index.js";
import type {
  AgentConfig,
  AgentSession,
  AgentResponse,
  ConversationMessage,
  ActionResult,
  ResponseContext,
} from "./types.js";
import { parseIntent, parseIntentFallback } from "./intent-parser.js";
import { generateResponse, generateResponseFallback } from "./response-generator.js";

/**
 * TaskFlow Agent
 */
export class TaskFlowAgent {
  private app: TaskFlowApp;
  private config: AgentConfig;
  private session: AgentSession;
  private actorRef: ActorRef;

  constructor(
    app: TaskFlowApp,
    config: AgentConfig,
    sessionId?: string
  ) {
    this.app = app;
    this.config = {
      ...config,
      intentModel: config.intentModel ?? "gpt-4o-mini",
      responseModel: config.responseModel ?? "gpt-4o-mini",
      maxHistoryLength: config.maxHistoryLength ?? 10,
      language: config.language ?? "en",
    };

    // Create session
    const sid = sessionId ?? crypto.randomUUID();
    this.session = {
      sessionId: sid,
      history: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    // Register as assistant actor
    this.actorRef = app.registerAssistant(sid);
  }

  /**
   * Process a user message and return a response
   */
  async processMessage(userMessage: string): Promise<AgentResponse> {
    // Update session activity
    this.session.lastActivityAt = Date.now();

    // Add user message to history
    this.addToHistory("user", userMessage);

    try {
      // Get current state
      const state = this.app.getState();
      const computed = this.app.getComputed();

      if (!state || !computed) {
        return {
          message: this.config.language === "ko"
            ? "시스템이 아직 준비되지 않았습니다."
            : "System not ready yet.",
          actionTaken: false,
          isQueryResult: false,
        };
      }

      // Step 1: Parse intent
      const parsedIntent = this.config.apiKey
        ? await parseIntent(userMessage, state.tasks, this.config)
        : parseIntentFallback(userMessage, state.tasks);

      // Step 2: Execute action if needed
      let actionResult: ActionResult | undefined;

      if (parsedIntent.kind === "intent") {
        actionResult = await this.executeIntent(parsedIntent.intent);
      }

      // Step 3: Generate response
      const responseContext: ResponseContext = {
        userMessage,
        parsedIntent,
        tasks: state.tasks,
        computed: {
          todoCount: computed.todoCount,
          inProgressCount: computed.inProgressCount,
          reviewCount: computed.reviewCount,
          doneCount: computed.doneCount,
          deletedCount: computed.deletedCount,
        },
        viewMode: state.viewMode,
        actionResult,
        history: this.session.history.slice(-5),
      };

      const response = this.config.apiKey
        ? await generateResponse(responseContext, this.config)
        : generateResponseFallback(responseContext, this.config.language);

      // Add assistant response to history
      this.addToHistory("assistant", response.message);

      return response;
    } catch (error) {
      console.error("[Agent] Error processing message:", error);
      const errorMessage = this.config.language === "ko"
        ? "메시지 처리 중 오류가 발생했습니다."
        : "An error occurred while processing your message.";

      this.addToHistory("assistant", errorMessage);

      return {
        message: errorMessage,
        actionTaken: false,
        isQueryResult: false,
      };
    }
  }

  /**
   * Execute an intent via the TaskFlowApp
   */
  private async executeIntent(
    intent: { type: string; input?: unknown }
  ): Promise<ActionResult> {
    try {
      // Dispatch through the app with the agent's actor
      await this.app.dispatch(
        { type: intent.type, input: intent.input },
        this.actorRef
      );

      return {
        success: true,
        actionType: intent.type,
        affectedTaskIds: this.extractAffectedIds(intent),
      };
    } catch (error) {
      console.error("[Agent] Error executing intent:", error);
      return {
        success: false,
        actionType: intent.type,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Extract affected task IDs from an intent
   */
  private extractAffectedIds(
    intent: { type: string; input?: unknown }
  ): string[] | undefined {
    const input = intent.input;
    if (!input || typeof input !== "object") return undefined;

    const inputObj = input as Record<string, unknown>;

    if ("id" in inputObj && typeof inputObj.id === "string") {
      return [inputObj.id];
    }

    if ("taskId" in inputObj && typeof inputObj.taskId === "string") {
      return [inputObj.taskId];
    }

    return undefined;
  }

  /**
   * Add a message to the conversation history
   */
  private addToHistory(role: "user" | "assistant", content: string): void {
    this.session.history.push({
      role,
      content,
      timestamp: Date.now(),
    });

    // Trim history if needed
    const maxLength = this.config.maxHistoryLength ?? 10;
    if (this.session.history.length > maxLength) {
      this.session.history = this.session.history.slice(-maxLength);
    }
  }

  /**
   * Get the conversation history
   */
  getHistory(): ConversationMessage[] {
    return [...this.session.history];
  }

  /**
   * Clear the conversation history
   */
  clearHistory(): void {
    this.session.history = [];
  }

  /**
   * Get the session
   */
  getSession(): AgentSession {
    return { ...this.session };
  }

  /**
   * Get the actor reference
   */
  getActorRef(): ActorRef {
    return this.actorRef;
  }
}

/**
 * Create a TaskFlow agent
 */
export function createTaskFlowAgent(
  app: TaskFlowApp,
  config: AgentConfig,
  sessionId?: string
): TaskFlowAgent {
  return new TaskFlowAgent(app, config, sessionId);
}
