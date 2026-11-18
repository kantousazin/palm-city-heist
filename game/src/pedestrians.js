// pedestrians.js — Palmera City citizens: they stroll the sidewalks, cross at
// crosswalks, chat in pairs, and run screaming from gunfire, crashes and
// speeding cars in Palm City Heist.

import { createSeededRandom, pickFrom, randomRange } from './rng.js';
import { VERTICAL_ROADS, HORIZONTAL_ROADS, WORLD_WIDTH, WORLD_HEIGHT } from './world-city.js';

const SHIRT_COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#f368e0', '#ff9f43', '#54a0ff', '#5f27cd', '#c8d6e5', '#ff9ff3'];
const SKIN_TONES = ['#f2c9a0', '#e0ac82', '#c68863', '#9c6644', '#f7d7b5'];

export function spawnPedestrians(seed, count) {
  const rng = createSeededRandom(seed * 57 + 11);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const road = vertical ? pickFrom(rng, VERTICAL_ROADS) : pickFrom(rng, HORIZONTAL_ROADS);
    const side = rng() < 0.5 ? -1 : 1;
    const along = 90 + rng() * ((vertical ? WORLD_HEIGHT : WORLD_WIDTH) - 180);
    const ped = {
      x: vertical ? road + side * 76 : along,
      y: vertical ? along : road + side * 76,
      angle: rng() * Math.PI * 2, speed: 0, walkSpeed: randomRange(rng, 34, 62),
      vertical, road, side, dir: rng() < 0.5 ? 1 : -1,
      shirt: pickFrom(rng, SHIRT_COLORS), skin: pickFrom(rng, SKIN_TONES),
      panic: 0, phase: rng() * Math.PI * 2, chatTimer: randomRange(rng, 0, 6),
    };
    peds.push(ped);
  }
  return peds;
}

export function scarePedestrians(peds, x, y, radius) {
  for (const ped of peds) {
    const dx = ped.x - x, dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius) ped.panic = Math.max(ped.panic, 2.6);
  }
}

export function updatePedestrian(ped, dt, world) {
  ped.phase += dt * (ped.panic > 0 ? 13 : 7);
  let moveAngle = ped.angle;
  let speed = ped.walkSpeed;
  if (ped.panic > 0) {
    ped.panic -= dt;
    // Run directly away from the nearest threat the main loop registered.
    const dx = ped.x - world.threat.x, dy = ped.y - world.threat.y;
    moveAngle = Math.atan2(dy, dx);
    speed = 148;
  } else {
    // Stroll along the sidewalk; flip direction at the city edge or randomly.
    if (ped.vertical) moveAngle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    else moveAngle = ped.dir > 0 ? 0 : Math.PI;
    if (world.rng() < dt * 0.02) ped.dir = -ped.dir;
    if (world.rng() < dt * 0.012) { // cross the street at a crossing
      ped.side = -ped.side;
    }
    const targetX = ped.vertical ? ped.road + ped.side * 76 : ped.x;
    const targetY = ped.vertical ? ped.y : ped.road + ped.side * 76;
    if (ped.vertical) ped.x += (targetX - ped.x) * Math.min(1, 2.4 * dt);
    else ped.y += (targetY - ped.y) * Math.min(1, 2.4 * dt);
  }
  ped.angle = moveAngle;
  ped.x += Math.cos(moveAngle) * speed * dt;
  ped.y += Math.sin(moveAngle) * speed * dt;
  ped.x = Math.max(16, Math.min(WORLD_WIDTH - 16, ped.x));
  ped.y = Math.max(16, Math.min(WORLD_HEIGHT - 16, ped.y));
  ped.speed = speed;
}

export function drawPedestrian(ctx, ped, timeSeconds) {
  const bob = Math.sin(ped.phase) * 2.2;
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.scale(1.25, 1.25);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 4, 7, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(ped.angle + Math.PI / 2);
  // Legs swing while walking.
  ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 1); ctx.lineTo(-3 + bob, 9);
  ctx.moveTo(0, 1); ctx.lineTo(3 - bob, 9);
  ctx.stroke();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.roundRect(-5.5, -4, 11, 10, 4); ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(0, -7.5, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2d2a26';
  ctx.beginPath(); ctx.arc(0, -8.6, 4.6, Math.PI, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (ped.panic > 0.4) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', ped.x, ped.y - 20 - Math.sin(timeSeconds * 9) * 2);
  }
}
