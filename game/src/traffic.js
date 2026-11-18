// traffic.js — civilian traffic AI for Palm City Heist: cars follow lanes on
// the road grid, stop at red lights, turn at intersections, brake for the
// player and honk when blocked.

import { createSeededRandom, pickFrom } from './rng.js';
import { VERTICAL_ROADS, HORIZONTAL_ROADS, ROAD_WIDTH } from './world-city.js';
import { createCar, CAR_COLORS, CAR_KINDS } from './vehicles.js';

export const LANE_OFFSET = 31;

export function trafficLightPhase(timeSeconds) {
  // One shared light cycle: vertical green, all-red, horizontal green, all-red.
  const cycle = timeSeconds % 16;
  if (cycle < 7) return 'vertical';
  if (cycle < 8) return 'none';
  if (cycle < 15) return 'horizontal';
  return 'none';
}

export function spawnTraffic(seed, count) {
  const rng = createSeededRandom(seed * 101 + 3);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const dir = rng() < 0.5 ? 1 : -1;
    const roads = vertical ? VERTICAL_ROADS : HORIZONTAL_ROADS;
    const road = pickFrom(rng, roads);
    const along = 100 + rng() * 3300;
    const lane = dir * LANE_OFFSET;
    const x = vertical ? road + lane : Math.min(along, 3500);
    const y = vertical ? Math.min(along, 2500) : road + lane;
    const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = createCar(x, y, angle, pickFrom(rng, CAR_COLORS), pickFrom(rng, CAR_KINDS));
    car.traffic = { vertical, dir, road, speed: 120 + rng() * 70, turnChance: 0.35 + rng() * 0.3, blocked: 0 };
    cars.push(car);
  }
  return cars;
}

function nearestIntersectionAhead(car) {
  const t = car.traffic;
  const cross = t.vertical ? HORIZONTAL_ROADS : VERTICAL_ROADS;
  let best = null, bestDist = Infinity;
  for (const c of cross) {
    const pos = t.vertical ? car.y : car.x;
    const d = (c - pos) * t.dir;
    if (d > 10 && d < bestDist) { bestDist = d; best = c; }
  }
  return { at: best, dist: bestDist };
}

export function updateTrafficCar(car, dt, world) {
  const t = car.traffic;
  const phase = trafficLightPhase(world.timeSeconds);
  const myGreen = (t.vertical && phase === 'vertical') || (!t.vertical && phase === 'horizontal');
  let targetSpeed = t.speed;
  const { at, dist } = nearestIntersectionAhead(car);
  if (!myGreen && at !== null && dist < 95) targetSpeed = 0;
  // Brake for the car ahead and for the player; honk if stuck behind them.
  let nearestGap = Infinity;
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  for (const other of world.allCars) {
    if (other === car) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (ahead > 0 && ahead < nearestGap && side < 26) nearestGap = ahead;
  }
  if (nearestGap < 74) targetSpeed = Math.min(targetSpeed, Math.max(0, (nearestGap - 46) * 2.2));
  if (nearestGap < 60 && targetSpeed < 12) {
    t.blocked += dt;
    if (t.blocked > 1.4 && car.honkTimer <= 0) { car.honkTimer = 1.6; world.effects.onHonk(car); }
  } else t.blocked = 0;
  car.honkTimer = Math.max(0, car.honkTimer - dt);
  const current = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
  const accel = targetSpeed > current ? 130 : 340;
  const next = current + Math.sign(targetSpeed - current) * Math.min(Math.abs(targetSpeed - current), accel * dt);
  // Maybe turn at the intersection we are crossing.
  if (at !== null && dist < 14 && world.rng() < t.turnChance) {
    t.vertical = !t.vertical;
    t.road = at;
    if (world.rng() < 0.5) t.dir = -t.dir;
    car.angle = t.vertical ? (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (t.dir > 0 ? 0 : Math.PI);
    if (t.vertical) car.x = at + t.dir * LANE_OFFSET; else car.y = at + t.dir * LANE_OFFSET;
  }
  // Lane keeping: ease toward the lane centre line.
  const laneTarget = t.road + t.dir * LANE_OFFSET;
  if (t.vertical) car.x += (laneTarget - car.x) * Math.min(1, 3 * dt);
  else car.y += (laneTarget - car.y) * Math.min(1, 3 * dt);
  car.vx = Math.cos(car.angle) * next;
  car.vy = Math.sin(car.angle) * next;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = next;
  // Wrap around the city edge so traffic never runs out.
  if (car.x < -80) car.x = 3680; if (car.x > 3680) car.x = -80;
  if (car.y < -80) car.y = 2680; if (car.y > 2680) car.y = -80;
  void ROAD_WIDTH;
}
