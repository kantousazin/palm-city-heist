// missions.js — the six-mission story chain of Palm City Heist: delivery,
// stolen wheels, the marina drop, losing the heat, the Neon Wolves fight and
// the Palm City Bank heist, each with objectives, markers and rewards.

import { MISSION_DIALOGUE } from './story.js';
import { spawnGangPack } from './combat.js';
import { distanceBetween } from './rng.js';

// Marker positions sit on roads beside each landmark so cars can reach them.
export const MISSION_DEFS = [
  {
    id: 'delivery', title: 'FIRST DELIVERY', reward: 150,
    objective: 'Drive to Cafe Sol and pick up the package',
    marker: { x: 1520, y: 360 }, needsCar: false,
  },
  {
    id: 'wheels', title: 'BORROWED WHEELS', reward: 220,
    objective: 'Steal the marked car near the Depot Garage',
    marker: { x: 3320, y: 1330 }, needsCar: false, stealTarget: true,
  },
  {
    id: 'drop', title: 'THE MARINA DROP', reward: 300,
    objective: 'Deliver the car to the Marina Dock',
    marker: { x: 2720, y: 800 }, needsCar: true,
  },
  {
    id: 'heat', title: 'LOSE THE HEAT', reward: 260,
    objective: 'Escape the police — lose every wanted star',
    marker: null, needsCar: false, escape: true,
  },
  {
    id: 'neon', title: 'NEON TROUBLE', reward: 380,
    objective: 'On foot: drive off the Neon Wolves on the Strip',
    marker: { x: 920, y: 1900 }, needsCar: false, fight: true, gangCount: 3,
  },
  {
    id: 'heist', title: 'THE PALM CITY HEIST', reward: 900,
    objective: 'Grab the loot at Palm City Bank, then reach the Hideout',
    marker: { x: 920, y: 800 }, needsCar: false, heist: true,
    secondMarker: { x: 2720, y: 1900 },
  },
];

export function createMissionSystem(world) {
  return {
    index: 0, stage: 'go', done: false, completeTimer: 0, lastReward: 0,
    gangSpawned: false, heistLootTaken: false,
    get current() { return this.done ? null : MISSION_DEFS[this.index]; },
    startCurrent() {
      const def = this.current;
      if (!def) return;
      this.stage = 'go'; this.gangSpawned = false; this.heistLootTaken = false;
      const lines = MISSION_DIALOGUE[def.id];
      if (lines) world.dialogue.start(lines, null);
      if (def.escape) world.wanted.addCrime(65, world);
      if (def.stealTarget) world.markStealTarget(def.marker);
    },
    objectiveText() {
      const def = this.current;
      if (!def) return 'Free roam — Palm City is yours';
      if (def.escape) return def.objective + ` (stars: ${world.wanted.stars})`;
      if (def.fight && this.gangSpawned) {
        const left = world.gang.filter((g) => !g.dead).length;
        return `Neon Wolves remaining: ${left}`;
      }
      if (def.heist && this.heistLootTaken) return 'Escape to the Solano Hideout in Palm Heights';
      if (def.needsCar && !world.player.inCar) return def.objective + ' (you need a car)';
      return def.objective;
    },
    markerPosition() {
      const def = this.current;
      if (!def) return null;
      if (def.escape) return null;
      if (def.heist && this.heistLootTaken) return def.secondMarker;
      return def.marker;
    },
    update(dt) {
      const def = this.current;
      if (!def) return;
      if (this.completeTimer > 0) { this.completeTimer -= dt; return; }
      const player = world.player;
      if (def.escape) {
        if (world.wanted.stars === 0) this.complete(world);
        return;
      }
      if (def.fight) {
        const marker = def.marker;
        if (!this.gangSpawned && distanceBetween(player.x, player.y, marker.x, marker.y) < 240 && !player.inCar) {
          world.gang.push(...spawnGangPack(marker.x, marker.y, def.gangCount, ['Vex', 'Roxy', 'Juno']));
          this.gangSpawned = true;
          world.wanted.addCrime(10, world);
        }
        if (this.gangSpawned && world.gang.every((g) => g.dead)) this.complete(world);
        return;
      }
      const marker = this.markerPosition();
      if (!marker) return;
      const reach = def.needsCar || (def.heist && this.heistLootTaken) ? 74 : 56;
      if (distanceBetween(player.x, player.y, marker.x, marker.y) < reach) {
        if (def.needsCar && !player.inCar) return;
        if (def.stealTarget && !world.playerStoleTarget()) return;
        if (def.heist && !this.heistLootTaken) {
          this.heistLootTaken = true;
          world.wanted.addCrime(80, world);
          world.effects.onLootGrabbed(marker);
          world.dialogue.start([{ who: 'REN', text: 'Got the bag. Now — run.' }], null);
          return;
        }
        this.complete(world);
      }
    },
    complete(world) {
      const def = this.current;
      if (!def) return;
      world.player.money += def.reward;
      this.lastReward = def.reward;
      this.completeTimer = 3.2;
      world.effects.onMissionComplete(def);
      this.index += 1;
      if (this.index >= MISSION_DEFS.length) {
        this.done = true;
        const lines = MISSION_DIALOGUE.finale;
        if (lines) world.dialogue.start(lines, null);
      } else {
        this.startCurrent();
      }
      world.saveNow();
    },
  };
}
