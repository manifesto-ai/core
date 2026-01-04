import { loadDataset } from '../src/dataset/loader';
import { createTask } from '../src/bench/runner';

async function debugZeroSteps() {
  const dataset = await loadDataset('decompose');
  const tasks = dataset
    .filter(r => r.level_name === 'BabyAI-BossLevel-v0')
    .slice(0, 50)
    .map(r => createTask(r, 'decompose'));

  const zeroStepMissions = [
    'put the key behind you next to a door',
    'open the door in front of you and go to the door in front of you',
    'put a key next to a ball and open a red door',
    'put a key next to a red box and go to a purple key'
  ];

  for (const targetMission of zeroStepMissions) {
    const task = tasks.find(t => t.initialState.mission.toLowerCase() === targetMission);
    if (task) {
      console.log('\n=== Mission: ' + task.initialState.mission + ' ===');

      // Check what objects exist
      const mission = task.initialState.mission.toLowerCase();
      const agent = task.initialState.agent;
      const objects = task.initialState.objects;

      console.log('Agent at:', agent.x, agent.y, 'facing:', ['E','S','W','N'][agent.direction]);

      // Check for relative position objects
      const dx = [1, 0, -1, 0][agent.direction];
      const dy = [0, 1, 0, -1][agent.direction];
      const frontX = agent.x + dx;
      const frontY = agent.y + dy;
      const behindX = agent.x - dx;
      const behindY = agent.y - dy;

      const frontObj = objects.filter(o => o.x === frontX && o.y === frontY);
      const behindObj = objects.filter(o => o.x === behindX && o.y === behindY);

      console.log('Front cell (' + frontX + ',' + frontY + '):', frontObj.map(o => o.color + ' ' + o.type));
      console.log('Behind cell (' + behindX + ',' + behindY + '):', behindObj.map(o => o.color + ' ' + o.type));

      // List relevant objects
      if (mission.includes('key')) {
        console.log('Keys:', objects.filter(o => o.type === 'key').map(o => o.color + ' key at (' + o.x + ',' + o.y + ')'));
      }
      if (mission.includes('door')) {
        console.log('Doors:', objects.filter(o => o.type === 'door').map(o => o.color + ' door at (' + o.x + ',' + o.y + ') open=' + o.isOpen));
      }
      if (mission.includes('ball')) {
        console.log('Balls:', objects.filter(o => o.type === 'ball').map(o => o.color + ' ball at (' + o.x + ',' + o.y + ')'));
      }
      if (mission.includes('box')) {
        console.log('Boxes:', objects.filter(o => o.type === 'box').map(o => o.color + ' box at (' + o.x + ',' + o.y + ')'));
      }
    }
  }
}

debugZeroSteps().catch(console.error);
