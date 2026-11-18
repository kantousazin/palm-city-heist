// combat.js — gunplay in Palm City Heist: Ren's pistol (mouse aim), the Neon
// Wolves gang who shoot back, bullets, muzzle flashes and health.

import { distanceBetween } from './rng.js';
import { scarePedestrians } from './pedestrians.js';

export function createGangMember(x, y, name) {
  return {
    x, y, vx: 0, vy: 0, angle: 0, health: 60, maxHealth: 60,
    shootTimer: 1 + Math.random() * 1.4, name, dead: false, walkPhase: Math.random() * 6,
    shirt: '#7d1f4d',
  };
}

export function spawnGangPack(centerX, centerY, count, names) {
  const pack = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pack.push(createGangMember(centerX + Math.cos(a) * 90, centerY + Math.sin(a) * 90, names[i % names.length]));
  }
  return pack;
}

export function fireBullet(bullets, x, y, angle, fromPlayer, speed = 760) {
  bullets.push({
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    life: 0.55, fromPlayer, angle,
  });
}

export function updateBullets(bullets, dt, world) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let remove = b.life <= 0;
    if (!remove && world.cityBuildingAt(b.x, b.y)) {
      world.effects.onBulletHitWall(b);
      remove = true;
    }
    if (!remove && b.fromPlayer) {
      for (const gang of world.gang) {
        if (gang.dead) continue;
        if (distanceBetween(b.x, b.y, gang.x, gang.y) < 15) {
          gang.health -= 34;
          world.effects.onGangHit(gang);
          if (gang.health <= 0) { gang.dead = true; world.effects.onGangDown(gang); world.onGangDown(gang); }
          remove = true; break;
        }
      }
      if (!remove) for (const car of world.policeCars) {
        if (distanceBetween(b.x, b.y, car.x, car.y) < 30) {
          world.effects.onBulletHitWall(b);
          world.wanted.addCrime(9, world);
          remove = true; break;
        }
      }
    }
    if (!remove && !b.fromPlayer) {
      const target = world.player.inCar || world.player;
      if (distanceBetween(b.x, b.y, target.x, target.y) < (world.player.inCar ? 30 : 14)) {
        world.damagePlayer(world.player.inCar ? 4 : 11);
        remove = true;
      }
    }
    if (remove) bullets.splice(i, 1);
  }
}

export function updateGangMember(gang, dt, world) {
  if (gang.dead) return;
  const player = world.player;
  const dist = distanceBetween(gang.x, gang.y, player.x, player.y);
  gang.angle = Math.atan2(player.y - gang.y, player.x - gang.x);
  gang.walkPhase += dt * 8;
  if (dist > 190) {
    gang.x += Math.cos(gang.angle) * 92 * dt;
    gang.y += Math.sin(gang.angle) * 92 * dt;
  } else if (dist < 90) {
    gang.x -= Math.cos(gang.angle) * 55 * dt;
    gang.y -= Math.sin(gang.angle) * 55 * dt;
  } else {
    gang.x += Math.cos(gang.angle + Math.PI / 2) * Math.sin(world.timeSeconds * 0.9 + gang.walkPhase) * 26 * dt;
    gang.y += Math.sin(gang.angle + Math.PI / 2) * Math.sin(world.timeSeconds * 0.9 + gang.walkPhase) * 26 * dt;
  }
  gang.shootTimer -= dt;
  if (gang.shootTimer <= 0 && dist < 330 && !player.dead) {
    gang.shootTimer = 1.1 + world.rng() * 1.3;
    const spread = (world.rng() - 0.5) * 0.24;
    fireBullet(world.bullets, gang.x, gang.y, gang.angle + spread, false, 620);
    world.effects.onGunshot(gang.x, gang.y, false);
  }
  void scarePedestrians;
}

export function drawGangMember(ctx, gang) {
  if (gang.dead) {
    ctx.save();
    ctx.translate(gang.x, gang.y);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#5d2340';
    ctx.beginPath(); ctx.roundRect(-6, -5, 12, 12, 5); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(gang.x, gang.y);
  ctx.scale(1.3, 1.3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 5, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(gang.angle + Math.PI / 2);
  ctx.fillStyle = gang.shirt;
  ctx.beginPath(); ctx.roundRect(-6.5, -5, 13, 12, 5); ctx.fill();
  ctx.fillStyle = '#e8b08a';
  ctx.beginPath(); ctx.arc(0, -8.5, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff4fd8';
  ctx.fillRect(-5, -13, 10, 3);
  ctx.restore();
  // Health bar over live gang members.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(gang.x - 14, gang.y - 26, 28, 5);
  ctx.fillStyle = '#ff4f6d';
  ctx.fillRect(gang.x - 13, gang.y - 25, 26 * Math.max(0, gang.health / gang.maxHealth), 3);
}
