/**
 * Test script to verify task creation works through Manifesto stack
 */

import { createTaskFlowApp } from './src/manifesto/app.js';

async function main() {
  console.log('=== Testing Task Creation ===\n');

  try {
    // 1. Create TaskFlow App
    console.log('1. Creating TaskFlow App...');
    const taskFlowApp = await createTaskFlowApp();
    console.log('   ✓ App created');

    // 2. Initialize app
    console.log('2. Initializing app...');
    await taskFlowApp.initialize();
    console.log('   ✓ App initialized');

    // 3. Dispatch createTask intent
    console.log('3. Dispatching createTask intent...');
    await taskFlowApp.createTask({
      title: 'Test Task from Script',
      description: 'This task was created by the test script',
      priority: 'high',
      dueDate: null,
      tags: ['test'],
    });
    console.log('   ✓ createTask dispatched');

    // 4. Check final snapshot
    console.log('\n4. Checking final snapshot...');
    const finalSnapshot = taskFlowApp.getSnapshot();
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
    taskFlowApp.dispose();

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

main();
