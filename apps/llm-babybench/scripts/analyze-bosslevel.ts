import { loadDataset } from '../src/dataset/loader';
import { createBFSActor } from '../src/actors/bfs-actor';
import { runTask, createTask, type BenchTask } from '../src/bench/runner';

async function analyze() {
  const dataset = await loadDataset('decompose');
  // Use createTask to properly parse the dataset rows
  const bossLevelTasks = dataset
    .filter(r => r.level_name === 'BabyAI-BossLevel-v0')
    .slice(0, 50)
    .map(r => createTask(r, 'decompose'));

  // Debug: check first task
  console.log('=== DEBUG: First Task ===');
  console.log('Mission:', bossLevelTasks[0].initialState.mission);
  console.log('Objects count:', bossLevelTasks[0].initialState.objects.length);
  console.log('Agent:', bossLevelTasks[0].initialState.agent);

  const failures: { mission: string; reason: string; steps: number; error?: string }[] = [];
  const successes: { mission: string; steps: number }[] = [];

  for (const task of bossLevelTasks) {
    const mission = task.initialState.mission;
    try {
      const actor = createBFSActor();
      const result = await runTask(task, actor);

      if (result.outcome === 'success') {
        successes.push({ mission, steps: result.steps });
      } else {
        failures.push({
          mission,
          reason: result.outcome === 'timeout' ? 'max_steps' : 'goal_not_reached',
          steps: result.steps
        });
      }
    } catch (err) {
      failures.push({
        mission,
        reason: 'error',
        steps: 0,
        error: String(err)
      });
    }
  }

  console.log('=== FAILURES (' + failures.length + '/' + bossLevelTasks.length + ') ===');

  // Group failures by pattern
  const patterns: Record<string, string[]> = {};
  for (const f of failures) {
    const mission = f.mission.toLowerCase();
    let pattern = 'other';

    if (mission.includes('behind') || mission.includes('in front') || mission.includes('on your left') || mission.includes('on your right')) {
      pattern = 'relative_position';
    } else if (mission.includes(' and ') || mission.includes(' then ') || mission.includes(', then') || mission.includes('after you')) {
      pattern = 'compound';
    } else if (mission.includes('open')) {
      pattern = 'open_door';
    } else if (mission.includes('pick up')) {
      pattern = 'pickup';
    } else if (mission.includes('put')) {
      pattern = 'put_next';
    } else if (mission.includes('go to')) {
      pattern = 'goto';
    }

    if (!patterns[pattern]) patterns[pattern] = [];
    patterns[pattern].push(f.mission + ' [' + f.reason + ', ' + f.steps + ' steps]');
  }

  // Show errors first
  const errors = failures.filter(f => (f as any).error);
  if (errors.length > 0) {
    console.log('\n--- ERRORS (' + errors.length + ') ---');
    errors.slice(0, 3).forEach(e => console.log('  ' + e.mission + ': ' + (e as any).error));
  }

  for (const [pattern, missions] of Object.entries(patterns)) {
    console.log('\n--- ' + pattern.toUpperCase() + ' (' + missions.length + ') ---');
    missions.slice(0, 5).forEach(m => console.log('  ' + m));
    if (missions.length > 5) console.log('  ... and ' + (missions.length - 5) + ' more');
  }

  console.log('\n=== SUCCESS RATE BY PATTERN ===');
  const successMissions = successes.map(s => s.mission.toLowerCase());
  const allMissions = [...failures.map(f => f.mission.toLowerCase()), ...successMissions];

  const patternStats: Record<string, { success: number; total: number }> = {};
  for (const mission of allMissions) {
    let pattern = 'simple';
    if (mission.includes('behind') || mission.includes('in front') || mission.includes('on your left') || mission.includes('on your right')) {
      pattern = 'relative_position';
    } else if (mission.includes(' and ') || mission.includes(' then ') || mission.includes(', then') || mission.includes('after you')) {
      pattern = 'compound';
    }

    if (!patternStats[pattern]) patternStats[pattern] = { success: 0, total: 0 };
    patternStats[pattern].total++;
    if (successMissions.includes(mission)) {
      patternStats[pattern].success++;
    }
  }

  for (const [pattern, stats] of Object.entries(patternStats)) {
    const rate = ((stats.success / stats.total) * 100).toFixed(1);
    console.log(pattern + ': ' + stats.success + '/' + stats.total + ' (' + rate + '%)');
  }
}

analyze().catch(console.error);
