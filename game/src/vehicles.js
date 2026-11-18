// vehicles.js — car bodies, driving physics (acceleration, drift, handbrake,
// collisions) and the parked cars Ren can steal in Palm City Heist.

import { createSeededRandom, pickFrom } from './rng.js';
import { VERTICAL_ROADS, HORIZONTAL_ROADS, resolveBuildingCollision, WORLD_WIDTH, WORLD_HEIGHT } from './world-city.js';

export const CAR_COLORS = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#ecf0f1', '#9b59b6', '#1abc9c', '#e67e22', '#fd79a8', '#00cec9', '#fdcb6e', '#636e72'];
export const CAR_KINDS = [
  { kind: 'compact', w: 46, h: 24, accel: 260, topSpeed: 300, grip: 5.2 },
  { kind: 'sedan', w: 52, h: 26, accel: 240, topSpeed: 330, grip: 4.8 },
  { kind: 'sport', w: 54, h: 25, accel: 340, topSpeed: 430, grip: 4.2 },
  { kind: 'pickup', w: 56, h: 28, accel: 210, topSpeed: 290, grip: 5.6 },
  { kind: 'van', w: 58, h: 30, accel: 190, topSpeed: 270, grip: 5.8 },
];

export function createCar(x, y, angle, color, kindDef, isPolice = false) {
  return {
    x, y, angle, vx: 0, vy: 0, speed: 0, steer: 0,
    w: kindDef.w, h: kindDef.h, kind: kindDef.kind,
    accel: kindDef.accel, topSpeed: kindDef.topSpeed, grip: kindDef.grip,
    color, isPolice, health: 100, driver: null, parked: false,
    honkTimer: 0, driftSmoke: 0, damageSmoke: 0,
  };
}

export function spawnParkedCars(seed, count) {
  const rng = createSeededRandom(seed * 31 + 7);
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < 900) {
    const vertical = rng() < 0.5;
    const road = vertical ? pickFrom(rng, VERTICAL_ROADS) : pickFrom(rng, HORIZONTAL_ROADS);
    const along = 120 + rng() * ((vertical ? WORLD_HEIGHT : WORLD_WIDTH) - 240);
    const side = rng() < 0.5 ? -1 : 1;
    const x = vertical ? road + side * 46 : along;
    const y = vertical ? along : road + side * 46;
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    const car = createCar(x, y, angle, pickFrom(rng, CAR_COLORS), pickFrom(rng, CAR_KINDS));
    car.parked = true;
    if (cars.some((c) => Math.abs(c.x - x) < 70 && Math.abs(c.y - y) < 70)) continue;
    cars.push(car);
  }
  return cars;
}

export function updateCarPhysics(car, input, dt, city, effects) {
  const forwardX = Math.cos(car.angle), forwardY = Math.sin(car.angle);
  const speedAlong = car.vx * forwardX + car.vy * forwardY;
  let throttle = 0;
  if (input.up) throttle = 1;
  if (input.down) throttle = speedAlong > 12 ? -1.4 : -0.55;
  const accelForce = throttle * car.accel;
  car.vx += forwardX * accelForce * dt;
  car.vy += forwardY * accelForce * dt;
  // Steering scales with speed; handbrake loosens the rear end for drift.
  const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const speedFactor = Math.max(-1, Math.min(1, speedAlong / 120));
  car.angle += steerInput * speedFactor * (input.handbrake ? 2.5 : 1.85) * dt * Math.min(1, Math.abs(speedAlong) / 90 + 0.25);
  // Grip: kill lateral velocity, less of it while handbraking (drift feel).
  const rightX = -forwardY, rightY = forwardX;
  const lateral = car.vx * rightX + car.vy * rightY;
  const gripRate = input.handbrake ? 1.6 : car.grip;
  car.vx -= rightX * lateral * Math.min(1, gripRate * dt);
  car.vy -= rightY * lateral * Math.min(1, gripRate * dt);
  car.driftSmoke = Math.abs(lateral) > 55 && Math.abs(speedAlong) > 80 ? 1 : 0;
  // Rolling drag and top speed.
  car.vx -= car.vx * 0.55 * dt;
  car.vy -= car.vy * 0.55 * dt;
  const totalSpeed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
  if (totalSpeed > car.topSpeed) {
    car.vx = (car.vx / totalSpeed) * car.topSpeed;
    car.vy = (car.vy / totalSpeed) * car.topSpeed;
  }
  car.speed = speedAlong;
  const oldX = car.x, oldY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.x = Math.max(24, Math.min(WORLD_WIDTH - 24, car.x));
  car.y = Math.max(24, Math.min(WORLD_HEIGHT - 24, car.y));
  const fixed = resolveBuildingCollision(city, car.x, car.y, 26);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    const impact = totalSpeed;
    car.x = fixed.x; car.y = fixed.y;
    car.vx *= -0.25; car.vy *= -0.25;
    if (impact > 90 && effects) effects.onCarCrash(car, impact, oldX, oldY);
  }
  car.damageSmoke = car.health < 45 ? 1 : 0;
  return totalSpeed;
}

export function drawCarShape(ctx, car, isPlayerCar) {
  const { w, h } = car;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.roundRect(-w / 2 + 3, -h / 2 + 5, w, h, 7); ctx.fill();
  ctx.fillStyle = car.color;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.roundRect(-w / 2 + 4, -h / 2 + 3, 9, h - 6, 4); ctx.fill();
  ctx.beginPath(); ctx.roundRect(w / 2 - 13, -h / 2 + 3, 9, h - 6, 4); ctx.fill();
  // Cabin and windows.
  ctx.fillStyle = '#1d2b38';
  ctx.beginPath(); ctx.roundRect(-w * 0.16, -h / 2 + 4, w * 0.34, h - 8, 4); ctx.fill();
  ctx.fillStyle = '#7fd4e8';
  ctx.beginPath(); ctx.roundRect(w * 0.02, -h / 2 + 5, w * 0.13, h - 10, 3); ctx.fill();
  ctx.fillStyle = '#2b3e4d';
  ctx.beginPath(); ctx.roundRect(-w * 0.30, -h / 2 + 5, w * 0.12, h - 10, 3); ctx.fill();
  // Wheels.
  ctx.fillStyle = '#14181c';
  for (const [wx, wy] of [[-w / 2 + 9, -h / 2 - 2], [w / 2 - 9, -h / 2 - 2], [-w / 2 + 9, h / 2 - 3], [w / 2 - 9, h / 2 - 3]]) {
    ctx.fillRect(wx - 5, wy, 10, 5);
  }
  // Headlights and tail lights.
  ctx.fillStyle = '#fff6bf';
  ctx.fillRect(w / 2 - 3, -h / 2 + 3, 3, 5); ctx.fillRect(w / 2 - 3, h / 2 - 8, 3, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-w / 2, -h / 2 + 3, 3, 5); ctx.fillRect(-w / 2, h / 2 - 8, 3, 5);
  if (car.isPolice) drawPoliceLivery(ctx, car);
  if (isPlayerCar) {
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 9); ctx.stroke();
  }
  ctx.restore();
}

function drawPoliceLivery(ctx, car) {
  const { w, h } = car;
  ctx.fillStyle = '#f4f6f8';
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 7); ctx.fill();
  ctx.fillStyle = '#1c2733';
  ctx.beginPath(); ctx.roundRect(-w * 0.18, -h / 2 + 3, w * 0.4, h - 6, 4); ctx.fill();
  ctx.fillStyle = '#7fd4e8';
  ctx.beginPath(); ctx.roundRect(-w * 0.02, -h / 2 + 4, w * 0.16, h - 8, 3); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('POLICE', 2, 0);
  // Light bar: red/blue halves, flashing handled by caller via time.
  ctx.fillStyle = '#ff2d2d'; ctx.fillRect(-8, -h / 2 - 4, 8, 4);
  ctx.fillStyle = '#2d6bff'; ctx.fillRect(0, -h / 2 - 4, 8, 4);
}
