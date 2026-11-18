// hud-minimap.js — the screen-space HUD of Palm City Heist: health and cash,
// the wanted stars, the mission objective banner, district name cards, the
// "MISSION COMPLETE" splash, bust/wasted overlays and the live minimap that
// shows streets, Ren, police, traffic and the objective marker.

import { VERTICAL_ROADS, HORIZONTAL_ROADS, WORLD_WIDTH, WORLD_HEIGHT, DISTRICTS } from './world-city.js';

export function drawWantedStars(ctx, stars, x, y, timeSeconds) {
  ctx.save();
  ctx.font = '30px system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    const active = i < stars;
    const flash = active && stars >= 4 && Math.sin(timeSeconds * 7) > 0.2;
    ctx.fillStyle = active ? (flash ? '#ff5252' : '#ffd23f') : 'rgba(255,255,255,0.22)';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 3;
    const sx = x + i * 34;
    ctx.strokeText('★', sx, y);
    ctx.fillText('★', sx, y);
  }
  ctx.restore();
}

export function drawHud(ctx, world, viewW, viewH) {
  const { player, wanted } = world;
  ctx.save();
  // Top-left panel: health bar + money.
  ctx.fillStyle = 'rgba(8,14,20,0.62)';
  ctx.beginPath(); ctx.roundRect(14, 14, 252, 76, 10); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(player.inCar ? 'REN SOLANO — DRIVING' : 'REN SOLANO', 26, 21);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(26, 42, 180, 13);
  const hpRatio = Math.max(0, player.health / player.maxHealth);
  ctx.fillStyle = hpRatio > 0.35 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(27, 43, 178 * hpRatio, 11);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(Math.ceil(player.health) + ' HP', 30, 43);
  ctx.fillStyle = '#7dff5a';
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.fillText('$' + player.money.toLocaleString('en-US'), 26, 60);
  if (player.inCar) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 13px system-ui, sans-serif';
    const speed = Math.round(Math.abs(player.inCar.speed) * 0.36);
    ctx.fillText(speed + ' km/h', 150, 63);
  }
  // Wanted stars top-right.
  drawWantedStars(ctx, wanted.stars, viewW - 196, 34, world.timeSeconds);
  if (wanted.stars > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(wanted.unseenTime > 1.5 ? 'LOSING THE POLICE…' : 'WANTED', viewW - 22, 52);
  }
  // Mission banner top-center.
  const def = world.missions.current;
  ctx.fillStyle = 'rgba(8,14,20,0.66)';
  const bannerW = Math.min(560, viewW - 560);
  if (bannerW > 240) {
    ctx.beginPath(); ctx.roundRect((viewW - bannerW) / 2, 14, bannerW, 62, 10); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(def ? 'MISSION — ' + def.title : 'PALM CITY HEIST', viewW / 2, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(world.missions.objectiveText(), viewW / 2, 42);
  }
  // District card.
  if (world.districtCardTimer > 0) {
    const a = Math.min(1, world.districtCardTimer);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 5;
    const name = DISTRICTS[world.currentDistrict].name;
    ctx.strokeText(name, 26, viewH - 120);
    ctx.fillText(name, 26, viewH - 120);
    ctx.globalAlpha = 1;
  }
  // Controls hint bottom-left.
  ctx.fillStyle = 'rgba(8,14,20,0.55)';
  ctx.beginPath(); ctx.roundRect(14, viewH - 66, 330, 52, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(player.inCar ? 'WASD drive · SPACE handbrake · E exit car' : 'WASD move · SHIFT sprint · E enter car · CLICK shoot', 24, viewH - 58);
  ctx.fillText('Missions pay cash. Crime raises ★. Hide to cool off.', 24, viewH - 40);
  drawMinimap(ctx, world, viewW, viewH);
  ctx.restore();
}

export function drawMinimap(ctx, world, viewW, viewH) {
  const mw = 196, mh = 142;
  const x = viewW - mw - 14, y = viewH - mh - 14;
  const sx = mw / WORLD_WIDTH, sy = mh / WORLD_HEIGHT;
  ctx.save();
  ctx.fillStyle = 'rgba(10,18,26,0.82)';
  ctx.beginPath(); ctx.roundRect(x - 4, y - 4, mw + 8, mh + 8, 10); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x, y, mw, mh, 7); ctx.clip();
  ctx.fillStyle = '#3f5a46';
  ctx.fillRect(x, y, mw, mh);
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(x, y + 2280 * sy, mw, 320 * sy + 4);
  ctx.fillStyle = '#3d9bc4';
  ctx.fillRect(x + mw - 14, y, 14, 1300 * sy);
  ctx.strokeStyle = '#20242c'; ctx.lineWidth = 3;
  for (const rx of VERTICAL_ROADS) { ctx.beginPath(); ctx.moveTo(x + rx * sx, y); ctx.lineTo(x + rx * sx, y + mh); ctx.stroke(); }
  for (const ry of HORIZONTAL_ROADS) { ctx.beginPath(); ctx.moveTo(x, y + ry * sy); ctx.lineTo(x + mw, y + ry * sy); ctx.stroke(); }
  // Traffic dots.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const car of world.trafficCars) ctx.fillRect(x + car.x * sx - 1, y + car.y * sy - 1, 2.4, 2.4);
  // Objective marker: pulsing gold.
  const marker = world.missions.markerPosition();
  if (marker) {
    const pulse = 3.4 + Math.sin(world.timeSeconds * 5) * 1.2;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(x + marker.x * sx, y + marker.y * sy, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x + marker.x * sx, y + marker.y * sy, pulse + 2.4, 0, Math.PI * 2); ctx.stroke();
  }
  // Police: blue/red blinkers.
  for (const car of world.policeCars) {
    ctx.fillStyle = Math.sin(world.timeSeconds * 9) > 0 ? '#ff4040' : '#3d7bff';
    ctx.beginPath(); ctx.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Gang: magenta.
  ctx.fillStyle = '#ff4fd8';
  for (const g of world.gang) if (!g.dead) ctx.fillRect(x + g.x * sx - 2, y + g.y * sy - 2, 4, 4);
  // Player: white arrow.
  const p = world.player.inCar || world.player;
  ctx.fillStyle = '#ffffff';
  ctx.save();
  ctx.translate(x + p.x * sx, y + p.y * sy);
  ctx.rotate(world.player.inCar ? world.player.inCar.angle : world.player.angle);
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('PALMERA CITY', viewW - 18, viewH - mh - 24);
}

export function drawMissionCompleteSplash(ctx, world, viewW, viewH) {
  if (world.missions.completeTimer <= 0) return;
  const a = Math.min(1, world.missions.completeTimer);
  ctx.save();
  ctx.globalAlpha = Math.min(1, a * 1.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 8;
  const y = viewH * 0.3;
  ctx.strokeText('MISSION COMPLETE', viewW / 2, y);
  ctx.fillText('MISSION COMPLETE', viewW / 2, y);
  ctx.fillStyle = '#7dff5a';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.strokeText('+$' + world.missions.lastReward, viewW / 2, y + 42);
  ctx.fillText('+$' + world.missions.lastReward, viewW / 2, y + 42);
  ctx.restore();
}

export function drawTitleScreen(ctx, viewW, viewH, hasSaveData, timeSeconds) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, 'rgba(16,24,44,0.88)');
  grad.addColorStop(0.55, 'rgba(64,28,64,0.82)');
  grad.addColorStop(1, 'rgba(12,14,24,0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('★ PALMERA CITY ★', viewW / 2, viewH * 0.24);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 3;
  ctx.strokeText('PALM CITY', viewW / 2, viewH * 0.24 + 78);
  ctx.fillText('PALM CITY', viewW / 2, viewH * 0.24 + 78);
  ctx.fillStyle = '#22e6ff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.strokeText('HEIST', viewW / 2, viewH * 0.24 + 158);
  ctx.fillText('HEIST', viewW / 2, viewH * 0.24 + 158);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('An open-world crime story: steal cars, run missions, dodge the Palm City PD.', viewW / 2, viewH * 0.24 + 205);
  const blink = Math.sin(timeSeconds * 3.4) > -0.2;
  if (blink) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(hasSaveData ? 'PRESS ENTER — CONTINUE   ·   N — NEW GAME' : 'PRESS ENTER TO PLAY', viewW / 2, viewH * 0.72);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD move / drive · E enter & exit car · SHIFT sprint · SPACE handbrake · Mouse aim, click to shoot', viewW / 2, viewH * 0.78);
  ctx.fillText('Progress saves automatically to this browser.', viewW / 2, viewH * 0.78 + 24);
  ctx.restore();
}

export function drawWastedOverlay(ctx, world, viewW, viewH, busted) {
  ctx.save();
  ctx.fillStyle = 'rgba(20,4,4,0.55)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = busted ? '#3d7bff' : '#e74c3c';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(busted ? 'BUSTED' : 'WASTED', viewW / 2, viewH / 2);
  ctx.fillStyle = '#ffffff';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText(busted ? 'The Palm City PD got you. The hospital patched you up — for a fee.' : 'You wake up at Palm General Hospital, lighter in the wallet.', viewW / 2, viewH / 2 + 40);
  ctx.restore();
}
