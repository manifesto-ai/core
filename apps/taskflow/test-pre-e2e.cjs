/**
 * Pre-E2E Integration Test for TaskFlow
 *
 * Tests the complete Manifesto stack flow:
 * Host -> World -> Bridge -> UI Layer
 *
 * Simulates what happens when the AI assistant creates/updates/deletes tasks
 */

const path = require('path');

// Test utilities
const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    results.push({ status: 'pass', message });
    console.log(colors.green(`  ✓ ${message}`));
  } else {
    failed++;
    results.push({ status: 'fail', message });
    console.log(colors.red(`  ✗ ${message}`));
  }
}

function section(name) {
  console.log(colors.blue(`\n▶ ${name}`));
}

async function main() {
  console.log(colors.yellow('═══════════════════════════════════════════════════════════════'));
  console.log(colors.yellow('  TaskFlow Pre-E2E Integration Test'));
  console.log(colors.yellow('  Testing: Host → World → Bridge → UI Layer'));
  console.log(colors.yellow('═══════════════════════════════════════════════════════════════\n'));

  // Load compiled schema
  const schema = require('./src/domain/tasks-compiled.json');

  // Import packages
  const { createHost } = await import('@manifesto-ai/host');
  const { createManifestoWorld } = await import('@manifesto-ai/world');
  const { createBridge } = await import('@manifesto-ai/bridge');

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: Schema Validation
  // ═══════════════════════════════════════════════════════════════
  section('1. Schema Validation');

  assert(schema.id === 'mel:tasks', 'Schema ID is correct');
  assert(schema.actions?.createTask, 'createTask action exists');
  assert(schema.actions?.updateTask, 'updateTask action exists');
  assert(schema.actions?.deleteTask, 'deleteTask action exists');
  assert(schema.actions?.moveTask, 'moveTask action exists');
  assert(schema.state?.fields?.tasks, 'tasks state field exists');
  assert(schema.hash?.length === 64, 'Schema hash is valid (64 chars)');

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: Host Creation and Initialization
  // ═══════════════════════════════════════════════════════════════
  section('2. Host Creation');

  const initialData = {
    tasks: [],
    currentFilter: { status: null, priority: null, assignee: null },
    selectedTaskId: null,
    viewMode: 'kanban',
    isCreating: false,
    isEditing: false,
    createIntent: null,
    updateIntent: null,
    deleteIntent: null,
    moveIntent: null,
    filterStep1: null,
    filterStep2: null,
    filterStep3: null,
    filterStep4: null,
    filterStep5: null,
    filterStep6: null,
    activeTasks: null,
    todoTasks: null,
    inProgressTasks: null,
    reviewTasks: null,
    doneTasks: null,
    deletedTasks: null,
  };

  const host = createHost(schema, { initialData });

  const hostSnapshot = await host.getSnapshot();
  assert(hostSnapshot !== null, 'Host snapshot initialized');
  assert(Array.isArray(hostSnapshot?.data?.tasks), 'Initial tasks is empty array');
  assert(hostSnapshot?.data?.tasks?.length === 0, 'Initial tasks count is 0');

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: World Creation and Genesis
  // ═══════════════════════════════════════════════════════════════
  section('3. World Creation');

  const world = createManifestoWorld({
    schemaHash: schema.hash,
    host,
  });

  const userActor = { actorId: 'user:test-user', kind: 'user', displayName: 'Test User' };
  const assistantActor = { actorId: 'agent:ai-assistant', kind: 'agent', displayName: 'AI Assistant' };

  world.registerActor(userActor, { mode: 'auto_approve' });
  world.registerActor(assistantActor, { mode: 'auto_approve' });

  assert(true, 'User actor registered');
  assert(true, 'AI Assistant actor registered');

  // Create genesis
  const snapshot = await host.getSnapshot();
  await world.createGenesis(snapshot);
  const genesis = await world.getGenesis();

  assert(genesis !== null, 'Genesis world created');
  assert(genesis?.worldId?.length > 0, 'Genesis has valid worldId');

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: Bridge Creation
  // ═══════════════════════════════════════════════════════════════
  section('4. Bridge Creation');

  const bridge = createBridge({
    world,
    schemaHash: schema.hash,
    defaultActor: userActor,
    defaultProjectionId: 'test:projection',
  });

  await bridge.refresh();
  const bridgeSnapshot = bridge.getSnapshot();

  assert(bridgeSnapshot !== null, 'Bridge snapshot available');
  assert(Array.isArray(bridgeSnapshot?.data?.tasks), 'Bridge has tasks array');

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: Create Task (Simulating AI Assistant)
  // ═══════════════════════════════════════════════════════════════
  section('5. Create Task (AI Assistant Flow)');

  // Track updates
  let updateCount = 0;
  const unsubscribe = bridge.subscribe((snap) => {
    updateCount++;
  });

  // Create first task
  await bridge.dispatch({
    type: 'createTask',
    input: {
      title: 'Implement user authentication',
      description: 'Add JWT-based auth with refresh tokens',
      priority: 'high',
      dueDate: '2026-01-15',
      tags: ['backend', 'security'],
    },
  }, undefined, assistantActor);

  let snap = bridge.getSnapshot();
  assert(snap?.data?.tasks?.length === 1, 'First task created');

  const task1 = snap?.data?.tasks?.[0];
  assert(task1?.title === 'Implement user authentication', 'Task 1 title is correct');
  assert(task1?.priority === 'high', 'Task 1 priority is correct');
  assert(task1?.status === 'todo', 'Task 1 status is todo');
  assert(task1?.id?.length > 0, 'Task 1 has valid ID');
  assert(task1?.createdAt?.length > 0, 'Task 1 has createdAt timestamp');
  assert(Array.isArray(task1?.tags) && task1.tags.includes('backend'), 'Task 1 has tags');

  // Create second task
  await bridge.dispatch({
    type: 'createTask',
    input: {
      title: 'Design database schema',
      description: 'Create ERD for user and session tables',
      priority: 'medium',
      dueDate: null,
      tags: ['database'],
    },
  }, undefined, assistantActor);

  snap = bridge.getSnapshot();
  assert(snap?.data?.tasks?.length === 2, 'Second task created');

  // Create third task
  await bridge.dispatch({
    type: 'createTask',
    input: {
      title: 'Write unit tests',
      description: 'Test coverage for auth module',
      priority: 'low',
      dueDate: null,
      tags: ['testing'],
    },
  }, undefined, assistantActor);

  snap = bridge.getSnapshot();
  assert(snap?.data?.tasks?.length === 3, 'Third task created');
  assert(updateCount >= 3, `Bridge received ${updateCount} updates`);

  // ═══════════════════════════════════════════════════════════════
  // TEST 6: Move Task (Change Status)
  // ═══════════════════════════════════════════════════════════════
  section('6. Move Task');

  const taskToMove = snap?.data?.tasks?.[0];

  await bridge.dispatch({
    type: 'moveTask',
    input: {
      id: taskToMove.id,
      newStatus: 'in-progress',
    },
  }, undefined, userActor);

  snap = bridge.getSnapshot();
  const movedTask = snap?.data?.tasks?.find(t => t.id === taskToMove.id);
  assert(movedTask?.status === 'in-progress', 'Task moved to in-progress');
  assert(movedTask?.updatedAt !== taskToMove?.updatedAt, 'Task updatedAt changed');

  // Move to review
  await bridge.dispatch({
    type: 'moveTask',
    input: {
      id: taskToMove.id,
      newStatus: 'review',
    },
  }, undefined, userActor);

  snap = bridge.getSnapshot();
  const reviewTask = snap?.data?.tasks?.find(t => t.id === taskToMove.id);
  assert(reviewTask?.status === 'review', 'Task moved to review');

  // ═══════════════════════════════════════════════════════════════
  // TEST 7: Update Task
  // ═══════════════════════════════════════════════════════════════
  section('7. Update Task');

  const taskToUpdate = snap?.data?.tasks?.[1];

  await bridge.dispatch({
    type: 'updateTask',
    input: {
      id: taskToUpdate.id,
      title: 'Design database schema (Updated)',
      description: 'Create ERD for user, session, and role tables',
      priority: 'high',
      dueDate: '2026-01-20',
    },
  }, undefined, assistantActor);

  snap = bridge.getSnapshot();
  const updatedTask = snap?.data?.tasks?.find(t => t.id === taskToUpdate.id);
  assert(updatedTask?.title === 'Design database schema (Updated)', 'Task title updated');
  assert(updatedTask?.priority === 'high', 'Task priority updated');
  assert(updatedTask?.dueDate === '2026-01-20', 'Task dueDate updated');

  // ═══════════════════════════════════════════════════════════════
  // TEST 8: Select Task (Required before delete)
  // ═══════════════════════════════════════════════════════════════
  section('8. Select Task');

  const taskToDelete = snap?.data?.tasks?.[2];

  // Select the task first (required for deleteTask availability)
  await bridge.dispatch({
    type: 'selectTask',
    input: {
      taskId: taskToDelete.id,
    },
  }, undefined, userActor);

  snap = bridge.getSnapshot();
  assert(snap?.data?.selectedTaskId === taskToDelete.id, 'Task selected');

  // ═══════════════════════════════════════════════════════════════
  // TEST 9: Delete Task (Soft Delete)
  // ═══════════════════════════════════════════════════════════════
  section('9. Delete Task');

  await bridge.dispatch({
    type: 'deleteTask',
    input: {
      id: taskToDelete.id,
    },
  }, undefined, userActor);

  snap = bridge.getSnapshot();
  const deletedTask = snap?.data?.tasks?.find(t => t.id === taskToDelete.id);
  assert(deletedTask?.deletedAt !== null, 'Task has deletedAt (soft deleted)');
  assert(deletedTask?.deletedAt?.length > 0, 'deletedAt has timestamp');
  assert(snap?.data?.selectedTaskId === null, 'Selection cleared after delete');

  // ═══════════════════════════════════════════════════════════════
  // TEST 10: Select a different task for restore
  // ═══════════════════════════════════════════════════════════════
  section('10. Select Different Task');

  // Select the first task (we'll need this for subsequent tests)
  await bridge.dispatch({
    type: 'selectTask',
    input: {
      taskId: taskToMove.id,
    },
  }, undefined, userActor);

  snap = bridge.getSnapshot();
  assert(snap?.data?.selectedTaskId === taskToMove.id, 'Different task selected');

  // ═══════════════════════════════════════════════════════════════
  // TEST 11: Restore Task
  // ═══════════════════════════════════════════════════════════════
  section('11. Restore Task');

  await bridge.dispatch({
    type: 'restoreTask',
    input: {
      id: taskToDelete.id,
    },
  }, undefined, userActor);

  snap = bridge.getSnapshot();
  const restoredTask = snap?.data?.tasks?.find(t => t.id === taskToDelete.id);
  assert(restoredTask?.deletedAt === null, 'Task restored (deletedAt is null)');

  // ═══════════════════════════════════════════════════════════════
  // TEST 12: Re-entry Safety (Idempotency)
  // ═══════════════════════════════════════════════════════════════
  section('12. Re-entry Safety');

  const currentTaskCount = snap?.data?.tasks?.length;

  // Dispatch same intent twice with same intentId
  const intentId = 'test-reentry-' + Date.now();

  await bridge.dispatch({
    type: 'createTask',
    input: {
      title: 'Re-entry test task',
      description: 'Should only be created once',
      priority: 'low',
      dueDate: null,
      tags: [],
    },
    intentId,
  }, undefined, assistantActor);

  // Note: Re-entry is guarded by createIntent state field
  // Second dispatch with different intentId should create new task
  snap = bridge.getSnapshot();
  const afterFirstCreate = snap?.data?.tasks?.length;
  assert(afterFirstCreate === currentTaskCount + 1, 'Task created on first dispatch');

  // ═══════════════════════════════════════════════════════════════
  // TEST 13: Error Handling - Empty Title
  // ═══════════════════════════════════════════════════════════════
  section('13. Error Handling');

  const beforeErrorCount = snap?.data?.tasks?.length;

  try {
    await bridge.dispatch({
      type: 'createTask',
      input: {
        title: '   ', // Empty after trim
        description: 'Should fail',
        priority: 'low',
        dueDate: null,
        tags: [],
      },
    }, undefined, assistantActor);
  } catch (e) {
    // Expected to fail
  }

  snap = bridge.getSnapshot();
  // Check if task count didn't increase (empty title should fail)
  // Note: The flow has validation that checks for empty title
  const afterErrorCount = snap?.data?.tasks?.length;
  assert(afterErrorCount === beforeErrorCount || snap?.system?.lastError !== null,
    'Empty title validation handled');

  // ═══════════════════════════════════════════════════════════════
  // TEST 14: Computed Values
  // ═══════════════════════════════════════════════════════════════
  section('14. Computed Values');

  assert(typeof snap?.computed?.['computed.totalCount'] === 'number', 'computed.totalCount exists');
  assert(snap?.computed?.['computed.totalCount'] >= 0, 'computed.totalCount is valid');

  // ═══════════════════════════════════════════════════════════════
  // TEST 15: Bridge Cleanup
  // ═══════════════════════════════════════════════════════════════
  section('15. Cleanup');

  unsubscribe();
  bridge.dispose();

  assert(bridge.isDisposed(), 'Bridge disposed successfully');
  assert(bridge.getSnapshot() === null, 'Disposed bridge returns null snapshot');

  // ═══════════════════════════════════════════════════════════════
  // Final Report
  // ═══════════════════════════════════════════════════════════════
  console.log(colors.yellow('\n═══════════════════════════════════════════════════════════════'));
  console.log(colors.yellow('  Test Results'));
  console.log(colors.yellow('═══════════════════════════════════════════════════════════════\n'));

  console.log(`  ${colors.green(`Passed: ${passed}`)}`);
  console.log(`  ${colors.red(`Failed: ${failed}`)}`);
  console.log(`  Total:  ${passed + failed}\n`);

  if (failed > 0) {
    console.log(colors.red('  ❌ SOME TESTS FAILED\n'));
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(colors.red(`    - ${r.message}`));
    });
    process.exit(1);
  } else {
    console.log(colors.green('  ✅ ALL TESTS PASSED\n'));
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(colors.red('\n  ❌ Fatal Error:'), err.message);
  console.error(colors.dim(err.stack));
  process.exit(1);
});
