#!/usr/bin/env npx tsx
import { loadDataset } from '../src/dataset/index.js';
import { createTask } from '../src/bench/index.js';
import { parseEnvDescription } from '../src/dataset/index.js';

async function main() {
  const rows = await loadDataset('decompose', { limit: 5 });
  rows.forEach((r, i) => {
    console.log('---', i + 1, '---');
    console.log('level:', r.level_name);
    console.log('mission (row):', r.mission);
    console.log('target_subgoal:', r.target_subgoal);

    // Create task and see what mission is used
    const task = createTask(r, 'decompose');
    console.log('mission (task):', task.initialState.mission);

    // Parse env description
    const parsed = parseEnvDescription(r.env_description);
    console.log('parsed mission:', parsed.mission);
    console.log('objects:', parsed.objects.map(o => `${o.color} ${o.type} at (${o.position.x},${o.position.y})`).join(', '));
  });
}

main().catch(console.error);
