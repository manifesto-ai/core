/**
 * Test script to verify task creation works through Manifesto stack
 */

import { createTaskFlowWorld } from './src/manifesto/world.js';
import { createBridge } from '@manifesto-ai/bridge';

async function main() {
  console.log('=== Testing Task Creation ===\n');

  try {
    // 1. Create TaskFlow World
    console.log('1. Creating TaskFlow World...');
    const taskFlowWorld = await createTaskFlowWorld();
    console.log('   ✓ World created');

    // 2. Initialize (create genesis)
    console.log('2. Initializing world (genesis)...');
    await taskFlowWorld.initialize();
    console.log('   ✓ Genesis created');

    // 3. Create Bridge
    console.log('3. Creating Bridge...');
    const bridge = createBridge({
      world: taskFlowWorld.world,
      schemaHash: taskFlowWorld.world.schemaHash,
      defaultActor: taskFlowWorld.userActor,
      defaultProjectionId: 'bridge:taskflow',
    });

    // Subscribe to snapshot changes
    let snapshotCount = 0;
    bridge.subscribe((snapshot) => {
      snapshotCount++;
      const tasks = snapshot.data?.tasks || [];
      console.log(`   [Snapshot ${snapshotCount}] Tasks count: ${tasks.length}`);
    });

    // 4. Refresh bridge to get initial snapshot
    console.log('4. Refreshing bridge...');
    await bridge.refresh();

    // 5. Dispatch createTask intent
    console.log('5. Dispatching createTask intent...');
    await bridge.dispatch({
      type: 'createTask',
      input: {
        title: 'Test Task from Script',
        description: 'This task was created by the test script',
        priority: 'high',
        dueDate: null,
        tags: ['test'],
      },
    });
    console.log('   ✓ createTask dispatched');

    // 6. Check final snapshot
    console.log('\n6. Checking final snapshot...');
    const finalSnapshot = bridge.getSnapshot();
    const tasks = finalSnapshot?.data?.tasks || [];
    console.log(`   Tasks in snapshot: ${tasks.length}`);

    if (tasks.length > 0) {
      console.log('\n   Task details:');
      for (const task of tasks) {
        console.log(`   - ${task.title} (${task.status}, ${task.priority})`);
      }
      console.log('\n✅ TEST PASSED: Task creation works!');
    } else {
      console.log('\n❌ TEST FAILED: No tasks in snapshot');
      process.exit(1);
    }

    // Cleanup
    bridge.dispose();

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

main();
