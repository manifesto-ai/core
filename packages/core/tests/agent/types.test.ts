import { describe, it, expect } from 'vitest';
import type {
  AgentDecision,
  DecisionResult,
  DecisionSuccess,
  DecisionFailure,
  DecisionFeedback,
  ActionSuccessFeedback,
  ActionFailureFeedback,
  UnavailableActionFeedback,
  ValidationFailureFeedback,
  AgentDecisionLoop,
  AgentCapabilities,
  AgentSession,
} from '../../src/agent/types.js';

describe('Agent Types', () => {
  describe('AgentDecision', () => {
    it('should allow creating a decision', () => {
      const decision: AgentDecision = {
        id: 'decision-1',
        actionId: 'submitOrder',
        input: { orderId: '123' },
        reasoning: 'User requested to submit the order',
        confidence: 0.95,
        timestamp: Date.now(),
      };

      expect(decision.id).toBe('decision-1');
      expect(decision.actionId).toBe('submitOrder');
      expect(decision.confidence).toBe(0.95);
    });

    it('should allow decision without optional fields', () => {
      const decision: AgentDecision = {
        id: 'decision-2',
        actionId: 'clearCart',
        timestamp: Date.now(),
      };

      expect(decision.id).toBe('decision-2');
      expect(decision.input).toBeUndefined();
      expect(decision.reasoning).toBeUndefined();
      expect(decision.confidence).toBeUndefined();
    });
  });

  describe('DecisionResult', () => {
    it('should create a successful result', () => {
      const success: DecisionSuccess = {
        decisionId: 'decision-1',
        modifiedPaths: ['data.quantity', 'derived.total'],
        newContext: {
          snapshot: { data: {}, state: {}, derived: {}, async: {} },
          availableActions: [],
          unavailableActions: [],
          fieldPolicies: {},
          fields: [],
          metadata: { projectedAt: Date.now(), pathCount: 10, snapshotVersion: 2 },
        },
        durationMs: 50,
      };

      const result: DecisionResult = { ok: true, value: success };
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.decisionId).toBe('decision-1');
        expect(result.value.durationMs).toBe(50);
      }
    });

    it('should create a failure result', () => {
      const failure: DecisionFailure = {
        decisionId: 'decision-1',
        failureType: 'precondition_failed',
        error: {
          _tag: 'UnavailableAction',
          actionId: 'submitOrder',
          blockedReasons: [
            {
              path: 'derived.canSubmit',
              expected: 'true',
              actual: false,
              reason: 'Cart is empty',
            },
          ],
        },
        contextAtFailure: {
          snapshot: { data: {}, state: {}, derived: {}, async: {} },
          availableActions: [],
          unavailableActions: [],
          fieldPolicies: {},
          fields: [],
          metadata: { projectedAt: Date.now(), pathCount: 10, snapshotVersion: 1 },
        },
      };

      const result: DecisionResult = { ok: false, error: failure };
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.failureType).toBe('precondition_failed');
      }
    });
  });

  describe('DecisionFeedback', () => {
    it('should create ActionSuccessFeedback', () => {
      const feedback: ActionSuccessFeedback = {
        _tag: 'ActionSuccess',
        decisionId: 'decision-1',
        actionId: 'submitOrder',
        modifiedPaths: ['data.orderStatus'],
        newContext: {
          snapshot: { data: {}, state: {}, derived: {}, async: {} },
          availableActions: [],
          unavailableActions: [],
          fieldPolicies: {},
          fields: [],
          metadata: { projectedAt: Date.now(), pathCount: 10, snapshotVersion: 2 },
        },
        message: 'Order submitted successfully',
      };

      expect(feedback._tag).toBe('ActionSuccess');
      expect(feedback.message).toContain('successfully');
    });

    it('should create ActionFailureFeedback', () => {
      const feedback: ActionFailureFeedback = {
        _tag: 'ActionFailure',
        decisionId: 'decision-1',
        actionId: 'submitOrder',
        error: {
          _tag: 'EffectError',
          effect: { _tag: 'ApiCall', url: '/api/order', method: 'POST', description: '' },
          originalError: new Error('Network error'),
        },
        contextAtFailure: {
          snapshot: { data: {}, state: {}, derived: {}, async: {} },
          availableActions: [],
          unavailableActions: [],
          fieldPolicies: {},
          fields: [],
          metadata: { projectedAt: Date.now(), pathCount: 10, snapshotVersion: 1 },
        },
        message: 'Failed to submit order: Network error',
        suggestion: 'Check your network connection and try again',
      };

      expect(feedback._tag).toBe('ActionFailure');
      expect(feedback.suggestion).toBeDefined();
    });

    it('should create UnavailableActionFeedback', () => {
      const feedback: UnavailableActionFeedback = {
        _tag: 'UnavailableAction',
        decisionId: 'decision-1',
        actionId: 'checkout',
        blockedReasons: [
          {
            path: 'derived.hasItems',
            expected: 'true',
            actual: false,
            reason: 'Cart is empty',
          },
        ],
        contextAtFailure: {
          snapshot: { data: {}, state: {}, derived: {}, async: {} },
          availableActions: [],
          unavailableActions: [],
          fieldPolicies: {},
          fields: [],
          metadata: { projectedAt: Date.now(), pathCount: 10, snapshotVersion: 1 },
        },
        message: 'Action checkout is not available',
        suggestion: 'Add items to cart first',
      };

      expect(feedback._tag).toBe('UnavailableAction');
      expect(feedback.blockedReasons.length).toBe(1);
    });

    it('should create ValidationFailureFeedback', () => {
      const feedback: ValidationFailureFeedback = {
        _tag: 'ValidationFailure',
        decisionId: 'decision-1',
        actionId: 'updateQuantity',
        inputErrors: [
          { path: 'quantity', message: 'Quantity must be positive' },
        ],
        contextAtFailure: {
          snapshot: { data: {}, state: {}, derived: {}, async: {} },
          availableActions: [],
          unavailableActions: [],
          fieldPolicies: {},
          fields: [],
          metadata: { projectedAt: Date.now(), pathCount: 10, snapshotVersion: 1 },
        },
        message: 'Invalid input for action updateQuantity',
      };

      expect(feedback._tag).toBe('ValidationFailure');
      expect(feedback.inputErrors.length).toBe(1);
    });

    it('should use discriminated union correctly', () => {
      const feedbacks: DecisionFeedback[] = [
        {
          _tag: 'ActionSuccess',
          decisionId: 'd1',
          actionId: 'a1',
          modifiedPaths: [],
          newContext: {
            snapshot: { data: {}, state: {}, derived: {}, async: {} },
            availableActions: [],
            unavailableActions: [],
            fieldPolicies: {},
            fields: [],
            metadata: { projectedAt: Date.now(), pathCount: 0, snapshotVersion: 1 },
          },
          message: 'Success',
        },
        {
          _tag: 'ActionFailure',
          decisionId: 'd2',
          actionId: 'a2',
          error: {
            _tag: 'EffectError',
            effect: { _tag: 'Delay', ms: 100, description: '' },
            originalError: new Error('Timeout'),
          },
          contextAtFailure: {
            snapshot: { data: {}, state: {}, derived: {}, async: {} },
            availableActions: [],
            unavailableActions: [],
            fieldPolicies: {},
            fields: [],
            metadata: { projectedAt: Date.now(), pathCount: 0, snapshotVersion: 1 },
          },
          message: 'Failed',
        },
      ];

      for (const feedback of feedbacks) {
        switch (feedback._tag) {
          case 'ActionSuccess':
            expect(feedback.modifiedPaths).toBeDefined();
            break;
          case 'ActionFailure':
            expect(feedback.error).toBeDefined();
            break;
          case 'UnavailableAction':
            expect(feedback.blockedReasons).toBeDefined();
            break;
          case 'ValidationFailure':
            expect(feedback.inputErrors).toBeDefined();
            break;
        }
      }
    });
  });

  describe('AgentCapabilities', () => {
    it('should define full capabilities', () => {
      const capabilities: AgentCapabilities = {
        canRead: true,
        canExecute: true,
      };

      expect(capabilities.canRead).toBe(true);
      expect(capabilities.canExecute).toBe(true);
    });

    it('should define restricted capabilities', () => {
      const capabilities: AgentCapabilities = {
        canRead: true,
        canExecute: true,
        allowedActions: ['viewOrder', 'updateQuantity'],
        allowedPaths: ['data.quantity', 'derived.total'],
      };

      expect(capabilities.allowedActions).toContain('viewOrder');
      expect(capabilities.allowedPaths).toContain('data.quantity');
    });
  });

  describe('AgentSession', () => {
    it('should create a session', () => {
      const session: AgentSession = {
        sessionId: 'session-123',
        capabilities: {
          canRead: true,
          canExecute: true,
        },
        startedAt: Date.now(),
        decisionCount: 0,
        lastActivityAt: Date.now(),
      };

      expect(session.sessionId).toBe('session-123');
      expect(session.decisionCount).toBe(0);
    });
  });
});
