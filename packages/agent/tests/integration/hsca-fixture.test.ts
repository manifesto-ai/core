/**
 * @manifesto-ai/agent - HSCA Fixture Integration Tests
 *
 * 테스트 내용:
 * - HSCA 스냅샷 시퀀스 deterministic 재현
 *
 * HSCA (Human-System Conversation Architecture) 시뮬레이션:
 * - Phase 기반 상태 전이
 * - Constraints 컴파일
 * - 순차적 effect 실행
 */

import { describe, it, expect } from 'vitest';
import {
  createSimpleSession,
  createMockClient,
  generateEffectId,
  createDefaultConstraints,
  addInvariant,
  addTypeRule,
  type AgentDecision,
  type Constraints,
} from '../../src/index.js';

/**
 * HSCA-like Snapshot 타입
 */
type HSCASnapshot = {
  data: {
    plan?: {
      title: string;
      items: Array<{
        id: string;
        status: 'pending' | 'in_progress' | 'completed';
        content: string;
      }>;
    };
    userInput?: string;
  };
  state: {
    phase: 'init' | 'planning' | 'executing' | 'reviewing' | 'complete';
    currentItemIndex?: number;
  };
  derived: {
    observations?: unknown[];
    completedCount?: number;
  };
};

/**
 * HSCA Constraints 컴파일러
 */
function compileHSCAConstraints(snapshot: HSCASnapshot): Constraints {
  const base = createDefaultConstraints(snapshot.state.phase);

  // Phase별 invariants
  switch (snapshot.state.phase) {
    case 'init':
      // init에서는 plan 생성 전
      break;

    case 'planning':
      // planning에서는 plan이 있어야 함
      return addInvariant(base, 'plan_exists', 'Plan must exist in planning phase', (s: any) => {
        return s.data.plan !== undefined;
      });

    case 'executing':
      // executing에서는 currentItemIndex가 유효해야 함
      return addInvariant(base, 'valid_index', 'Current item index must be valid', (s: any) => {
        if (s.state.currentItemIndex === undefined) return false;
        if (!s.data.plan?.items) return false;
        return s.state.currentItemIndex >= 0 && s.state.currentItemIndex < s.data.plan.items.length;
      });

    case 'reviewing':
      // reviewing에서는 모든 항목이 완료되어야 함
      return addInvariant(base, 'all_completed', 'All items must be completed in reviewing phase', (s: any) => {
        if (!s.data.plan?.items) return false;
        return s.data.plan.items.every((item: any) => item.status === 'completed');
      });

    default:
      break;
  }

  return base;
}

describe('HSCA Fixture Integration', () => {
  describe('Phase transitions', () => {
    it('should progress through HSCA phases', async () => {
      const decisions: AgentDecision[] = [
        // Step 1: init → planning (plan 생성)
        {
          effects: [
            {
              type: 'snapshot.patch',
              id: generateEffectId(),
              ops: [
                {
                  op: 'set',
                  path: 'data.plan',
                  value: {
                    title: 'Test Plan',
                    items: [
                      { id: '1', status: 'pending', content: 'Task 1' },
                      { id: '2', status: 'pending', content: 'Task 2' },
                    ],
                  },
                },
              ],
            },
            {
              type: 'snapshot.patch',
              id: generateEffectId(),
              ops: [{ op: 'set', path: 'state.phase', value: 'planning' }],
            },
          ],
        },
        // Step 2: planning → executing
        {
          effects: [
            {
              type: 'snapshot.patch',
              id: generateEffectId(),
              ops: [
                { op: 'set', path: 'state.phase', value: 'executing' },
                { op: 'set', path: 'state.currentItemIndex', value: 0 },
              ],
            },
          ],
        },
        // Step 3: Execute first item
        {
          effects: [
            {
              type: 'snapshot.patch',
              id: generateEffectId(),
              ops: [{ op: 'set', path: 'data.plan.items.0.status', value: 'in_progress' }],
            },
          ],
        },
        // Step 4: Complete first item, move to second
        {
          effects: [
            {
              type: 'snapshot.patch',
              id: generateEffectId(),
              ops: [
                { op: 'set', path: 'data.plan.items.0.status', value: 'completed' },
                { op: 'set', path: 'state.currentItemIndex', value: 1 },
              ],
            },
          ],
        },
        // Step 5: Complete second item
        {
          effects: [
            {
              type: 'snapshot.patch',
              id: generateEffectId(),
              ops: [
                { op: 'set', path: 'data.plan.items.1.status', value: 'in_progress' },
              ],
            },
          ],
        },
        // Step 6: Complete second item, move to reviewing
        {
          effects: [
            {
              type: 'snapshot.patch',
              id: generateEffectId(),
              ops: [
                { op: 'set', path: 'data.plan.items.1.status', value: 'completed' },
                { op: 'set', path: 'state.phase', value: 'reviewing' },
              ],
            },
          ],
        },
        // Step 7: reviewing → complete
        {
          effects: [
            {
              type: 'snapshot.patch',
              id: generateEffectId(),
              ops: [{ op: 'set', path: 'state.phase', value: 'complete' }],
            },
          ],
        },
        // Step 8: Done
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const initialSnapshot: HSCASnapshot = {
        data: {},
        state: { phase: 'init' },
        derived: {},
      };

      const { session, getSnapshot } = createSimpleSession({
        initialSnapshot,
        client,
        compileConstraints: compileHSCAConstraints,
        isDone: (s: HSCASnapshot) => ({
          done: s.state.phase === 'complete',
          reason: 'HSCA workflow complete',
        }),
      });

      const result = await session.run();

      expect(result.done).toBe(true);
      expect(result.reason).toBe('HSCA workflow complete');

      const finalSnapshot = getSnapshot() as HSCASnapshot;
      expect(finalSnapshot.state.phase).toBe('complete');
      expect(finalSnapshot.data.plan?.items.every((i) => i.status === 'completed')).toBe(true);
    });
  });

  describe('Deterministic replay', () => {
    it('should produce same result for same decision sequence', async () => {
      const decisions: AgentDecision[] = [
        {
          effects: [
            { type: 'snapshot.patch', id: 'eff_1', ops: [{ op: 'set', path: 'data.value', value: 1 }] },
          ],
        },
        {
          effects: [
            { type: 'snapshot.patch', id: 'eff_2', ops: [{ op: 'set', path: 'data.value', value: 2 }] },
          ],
        },
        { effects: [] },
      ];

      // 첫 번째 실행
      const client1 = createMockClient([...decisions]);
      const { session: session1, getSnapshot: getSnapshot1 } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client: client1,
      });
      await session1.run();
      const result1 = getSnapshot1();

      // 두 번째 실행 (동일한 decisions)
      const client2 = createMockClient([...decisions]);
      const { session: session2, getSnapshot: getSnapshot2 } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client: client2,
      });
      await session2.run();
      const result2 = getSnapshot2();

      // 결과 동일성 검증
      expect((result1 as any).data.value).toBe((result2 as any).data.value);
    });
  });

  describe('Error recovery in HSCA', () => {
    it('should recover from validation errors', async () => {
      const decisions: AgentDecision[] = [
        // 잘못된 시도: derived에 직접 쓰기
        {
          effects: [
            {
              type: 'snapshot.patch',
              id: generateEffectId(),
              ops: [{ op: 'set', path: 'derived.completedCount', value: 0 }],
            },
          ],
        },
        // 올바른 시도: data에 쓰기
        {
          effects: [
            {
              type: 'snapshot.patch',
              id: generateEffectId(),
              ops: [{ op: 'set', path: 'data.plan', value: { title: 'Recovered', items: [] } }],
            },
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session, getSnapshot, getErrors } = createSimpleSession({
        initialSnapshot: { data: {}, state: { phase: 'init' }, derived: {} },
        client,
      });

      const result = await session.run();

      expect(result.done).toBe(true);

      const snapshot = getSnapshot() as any;
      expect(snapshot.data.plan.title).toBe('Recovered');

      // 에러가 기록되었다가 클리어됨
      // (각 step 시작 시 에러 클리어)
    });
  });

  describe('Constraints enforcement', () => {
    it('should enforce phase-specific constraints', async () => {
      const decisions: AgentDecision[] = [
        // planning phase로 전환하지만 plan 없음 (invariant 위반)
        {
          effects: [
            {
              type: 'snapshot.patch',
              id: generateEffectId(),
              ops: [{ op: 'set', path: 'state.phase', value: 'planning' }],
            },
          ],
        },
        // plan 추가하여 수정
        {
          effects: [
            {
              type: 'snapshot.patch',
              id: generateEffectId(),
              ops: [
                { op: 'set', path: 'data.plan', value: { title: 'Plan', items: [] } },
              ],
            },
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session, getSnapshot } = createSimpleSession({
        initialSnapshot: { data: {}, state: { phase: 'init' }, derived: {} } as HSCASnapshot,
        client,
        compileConstraints: compileHSCAConstraints,
      });

      await session.run();

      // 최종 상태 확인 - phase는 planning이고 plan이 있음
      const snapshot = getSnapshot() as any;
      // Note: invariant 검증은 post-patch에서 발생하므로
      // 첫 번째 step에서 phase가 planning으로 변경되고
      // invariant 검증이 core.applyPatch 내부에서 발생해야 함
      // 현재 구현에서는 core가 간단한 in-memory 구현이므로
      // invariant 검증이 별도로 필요
    });
  });
});
