// player.js — Ren Solano on foot: walking, sprinting, aiming, entering and
// leaving cars, health and respawning in Palm City Heist.

import { resolveBuildingCollision, WORLD_WIDTH, WORLD_HEIGHT } from './world-city.js';
import { distanceBetween } from './rng.js';

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, angle: -Math.PI / 2, aimAngle: 0,
    health: 100, maxHealth: 100, money: 120, inCar: null,
    walkPhase: 0, dead: false, respawnTimer: 0, name: 'Ren Solano',
  };
}

export function updatePlayerOnFoot(player, input, dt, city) {
  if (player.inCar || player.dead) return;
  let mx = 0, my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const moving = mx !== 0 || my !== 0;
  const speed = input.sprint ? 218 : 138;
  if (moving) {
    const len = Math.sqrt(mx * mx + my * my);
    player.angle = Math.atan2(my, mx);
    player.vx = (mx / len) * speed;
    player.vy = (my / len) * speed;
    player.walkPhase += dt * (input.sprint ? 13 : 9);
  } else {
    player.vx = 0; player.vy = 0;
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  const fixed = resolveBuildingCollision(city, player.x, player.y, 13);
  player.x = fixed.x; player.y = fixed.y;
  player.x = Math.max(14, Math.min(WORLD_WIDTH - 14, player.x));
  player.y = Math.max(14, Math.min(WORLD_HEIGHT - 14, player.y));
}

export function nearestEnterableCar(player, cars, maxDist = 52) {
  let best = null, bestDist = maxDist;
  for (const car of cars) {
    const d = distanceBetween(player.x, player.y, car.x, car.y);
    if (d < bestDist) { bestDist = d; best = car; }
  }
  return best;
}

export function enterCar(player, car) {
  player.inCar = car;
  car.driver = player;
  car.parked = false;
  player.x = car.x; player.y = car.y;
}

export function exitCar(player) {
  const car = player.inCar;
  if (!car) return null;
  player.inCar = null;
  car.driver = null;
  // Step out on the left side of the car.
  player.x = car.x + Math.cos(car.angle - Math.PI / 2) * 30;
  player.y = car.y + Math.sin(car.angle - Math.PI / 2) * 30;
  player.angle = car.angle;
  return car;
}

export function damagePlayer(player, amount, world) {
  if (player.dead) return;
  player.health -= amount;
  world.effects.onPlayerHurt(player);
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    player.respawnTimer = 2.2;
  }
}

export function respawnPlayer(player, world) {
  // Wasted / busted: wake up at Palm General, poorer and heat-free.
  player.dead = false;
  player.health = 100;
  player.inCar = null;
  player.x = 1520; player.y = 960;
  player.money = Math.max(0, player.money - Math.min(150, Math.floor(player.money * 0.25) + 40));
  world.wanted.clear();
  world.effects.onRespawn(player);
}

export function drawPlayerOnFoot(ctx, player, timeSeconds) {
  if (player.inCar || player.dead) return;
  const bob = Math.sin(player.walkPhase) * 2.4;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.scale(1.3, 1.3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 5, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(player.angle + Math.PI / 2);
  ctx.strokeStyle = '#274b63'; ctx.lineWidth = 3.8; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 1); ctx.lineTo(-3.4 + bob, 10);
  ctx.moveTo(0, 1); ctx.lineTo(3.4 - bob, 10);
  ctx.stroke();
  // Ren's teal jacket — his signature colour in every screenshot.
  ctx.fillStyle = '#0e7d86';
  ctx.beginPath(); ctx.roundRect(-6.5, -5, 13, 12, 5); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-6.5, 2, 13, 3);
  ctx.fillStyle = '#8a5a3b';
  ctx.beginPath(); ctx.arc(0, -8.5, 5.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.beginPath(); ctx.arc(0, -9.8, 5.2, Math.PI, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Aim line and gun when the mouse is held.
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.aimAngle);
  ctx.fillStyle = '#22262e';
  ctx.fillRect(6, -2, 13, 4);
  ctx.restore();
  // Player arrow so Ren is never lost in a busy street.
  const pulse = 1 + Math.sin(timeSeconds * 4) * 0.12;
  ctx.save();
  ctx.translate(player.x, player.y - 30);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(-6, -4); ctx.lineTo(6, -4); ctx.closePath(); ctx.fill();
  ctx.restore();
}
