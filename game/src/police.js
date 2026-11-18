// police.js — the Palm City PD: wanted stars, patrol spawning, pursuit and
// ramming AI, losing the heat, busts and hospital penalties in Palm City Heist.

import { createCar, CAR_KINDS } from './vehicles.js';
import { resolveBuildingCollision, WORLD_WIDTH, WORLD_HEIGHT } from './world-city.js';

export const MAX_WANTED = 5;

export function createWantedSystem() {
  return {
    stars: 0, heat: 0, crimeCooldown: 0, unseenTime: 0, bustProgress: 0,
    addCrime(amount, world) {
      this.heat = Math.min(100, this.heat + amount);
      const newStars = Math.min(MAX_WANTED, Math.floor(this.heat / 20) + (this.heat > 4 ? 1 : 0));
      if (newStars > this.stars) { this.stars = newStars; world.effects.onWantedRise(newStars); }
      this.unseenTime = 0;
      this.crimeCooldown = 0.5;
    },
    update(dt, playerSeen) {
      this.crimeCooldown = Math.max(0, this.crimeCooldown - dt);
      if (this.stars > 0 && !playerSeen) {
        this.unseenTime += dt;
        if (this.unseenTime > 6) {
          this.heat = Math.max(0, this.heat - dt * 7);
          this.stars = Math.max(0, Math.min(this.stars, Math.ceil(this.heat / 20)));
          if (this.heat <= 0) { this.stars = 0; this.unseenTime = 0; }
        }
      } else if (playerSeen) this.unseenTime = 0;
    },
    clear() { this.stars = 0; this.heat = 0; this.unseenTime = 0; this.bustProgress = 0; },
  };
}

const POLICE_KIND = CAR_KINDS[1];

export function spawnPoliceCar(player, existing, rng) {
  // Spawn just off-screen on a road near the player.
  const angle = rng() * Math.PI * 2;
  const dist = 560 + rng() * 160;
  const x = Math.max(40, Math.min(WORLD_WIDTH - 40, player.x + Math.cos(angle) * dist));
  const y = Math.max(40, Math.min(WORLD_HEIGHT - 40, player.y + Math.sin(angle) * dist));
  const car = createCar(x, y, Math.atan2(player.y - y, player.x - x), '#f4f6f8', POLICE_KIND, true);
  car.topSpeed = 356;
  car.accel = 300;
  existing.push(car);
  return car;
}

export function desiredPoliceCount(stars) {
  return [0, 1, 2, 3, 4, 6][Math.min(MAX_WANTED, stars)] || 0;
}

export function updatePoliceCar(car, dt, world) {
  const target = world.playerTarget;
  const dx = target.x - car.x, dy = target.y - car.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const desiredAngle = Math.atan2(dy, dx);
  // Predict a little ahead of a moving target to cut corners.
  const leadX = target.x + (target.vx || 0) * 0.35, leadY = target.y + (target.vy || 0) * 0.35;
  const chaseAngle = Math.atan2(leadY - car.y, leadX - car.x);
  let diff = chaseAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const speedNow = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 3.2 * dt * 3));
  const topSpeed = target.inCar ? 372 : 250;
  let throttle = dist > 30 ? 1 : 0.2;
  if (Math.abs(diff) > 2.2) throttle = -0.5; // reverse out of a bad angle
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  car.vx += fx * car.accel * throttle * dt;
  car.vy += fy * car.accel * throttle * dt;
  const lateral = car.vx * -fy + car.vy * fx;
  car.vx -= -fy * lateral * Math.min(1, 4.4 * dt);
  car.vy -= fx * lateral * Math.min(1, 4.4 * dt);
  car.vx -= car.vx * 0.5 * dt; car.vy -= car.vy * 0.5 * dt;
  const total = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
  if (total > topSpeed) { car.vx = car.vx / total * topSpeed; car.vy = car.vy / total * topSpeed; }
  car.x += car.vx * dt; car.y += car.vy * dt;
  const fixed = resolveBuildingCollision(world.city, car.x, car.y, 26);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    if (total > 100) world.effects.onCarCrash(car, total * 0.7, car.x, car.y);
    car.x = fixed.x; car.y = fixed.y; car.vx *= -0.3; car.vy *= -0.3;
  }
  car.speed = total;
  // Ramming contact with the player's car or body.
  if (dist < 40) {
    world.effects.onPoliceContact(car, target, Math.max(0, total - 40));
  }
  return dist;
}

export function policeSeesPlayer(policeCars, player) {
  for (const car of policeCars) {
    const dx = car.x - player.x, dy = car.y - player.y;
    if (dx * dx + dy * dy < 520 * 520) return true;
  }
  return false;
}
