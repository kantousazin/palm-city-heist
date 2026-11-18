// main.js — Palm City Heist: a top-down open-world crime game in Palmera City.
// Ren Solano, ex-delivery driver, works a chain of jobs for Mara: deliveries,
// stolen cars, a marina drop, a police escape, a gang fight on the Neon Strip
// and the Palm City Bank heist. Drive or walk a living city with traffic,
// pedestrians, traffic lights, a five-star wanted system and police chases.
// Plain Canvas + ES modules, no libraries, no network, all art drawn in code.

import { generateCity, districtAt, buildingAtPoint, DISTRICTS, VERTICAL_ROADS, HORIZONTAL_ROADS, ROAD_WIDTH, WORLD_WIDTH, WORLD_HEIGHT } from './world-city.js';
import { createSeededRandom } from './rng.js';
import { spawnParkedCars, updateCarPhysics, drawCarShape } from './vehicles.js';
import { spawnTraffic, updateTrafficCar, trafficLightPhase } from './traffic.js';
import { spawnPedestrians, updatePedestrian, drawPedestrian, scarePedestrians } from './pedestrians.js';
import { createWantedSystem, spawnPoliceCar, desiredPoliceCount, updatePoliceCar, policeSeesPlayer } from './police.js';
import { createPlayer, updatePlayerOnFoot, nearestEnterableCar, enterCar, exitCar, damagePlayer, respawnPlayer, drawPlayerOnFoot } from './player.js';
import { updateBullets, updateGangMember, drawGangMember, fireBullet } from './combat.js';
import { createMissionSystem } from './missions.js';
import { createDialogueBox, drawDialogueBox, STORY_INTRO } from './story.js';
import { createParticleSystem } from './particles.js';
import { createAudioSynth } from './audio-synth.js';
import { createCamera } from './camera.js';
import { loadSave, writeSave, clearSave } from './save-game.js';
import { drawHud, drawMissionCompleteSplash, drawTitleScreen, drawWastedOverlay } from './hud-minimap.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '1') || 1;

let viewW = 1280, viewH = 800;
function resizeCanvas() {
  viewW = window.innerWidth; viewH = window.innerHeight;
  canvas.width = viewW; canvas.height = viewH;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
if (shotName) { viewW = 1280; viewH = 800; canvas.width = 1280; canvas.height = 800; }

// ---------------------------------------------------------------- world state
const rng = createSeededRandom(seed * 977 + 5);
const city = generateCity(seed);
const audio = createAudioSynth();
const particles = createParticleSystem();
const camera = createCamera(viewW, viewH);

const world = {
  city, rng, particles, audio, camera,
  timeSeconds: 0, hour: 10.5, fixedHour: null,
  player: createPlayer(1520, 470),
  trafficCars: spawnTraffic(seed, 26),
  parkedCars: spawnParkedCars(seed, 30),
  policeCars: [],
  pedestrians: spawnPedestrians(seed, 46),
  gang: [], bullets: [],
  wanted: createWantedSystem(),
  dialogue: createDialogueBox(),
  missions: null, // set below
  threat: { x: -9999, y: -9999 },
  currentDistrict: 'downtown', districtCardTimer: 0,
  state: shotName ? 'play' : 'title',
  busted: false, shootCooldown: 0, stealTargetCar: null, totalEarned: 0,
  get allCars() {
    const list = [...this.trafficCars, ...this.parkedCars, ...this.policeCars];
    if (this.player.inCar && !list.includes(this.player.inCar)) list.push(this.player.inCar);
    return list;
  },
  get playerTarget() {
    const p = this.player;
    if (p.inCar) return { x: p.inCar.x, y: p.inCar.y, vx: p.inCar.vx, vy: p.inCar.vy, inCar: true };
    return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, inCar: false };
  },
  cityBuildingAt(x, y) { return buildingAtPoint(city, x, y); },
  saveNow() { writeSave(this); },
  markStealTarget(marker) {
    let best = null, bestDist = Infinity;
    for (const car of this.parkedCars) {
      const d = Math.hypot(car.x - marker.x, car.y - marker.y);
      if (d < bestDist) { bestDist = d; best = car; }
    }
    if (best) { best.color = '#ffd23f'; best.isStealTarget = true; this.stealTargetCar = best; }
  },
  playerStoleTarget() {
    return !!(this.stealTargetCar && this.player.inCar === this.stealTargetCar);
  },
  damagePlayer(amount) { damagePlayer(world.player, amount, world); },
  onGangDown() { /* mission system notices via gang state */ },
};

world.effects = {
  onCarCrash(car, impact, x, y) {
    particles.sparks(x, y);
    audio.crash(impact);
    if (car === world.player.inCar) {
      camera.addShake(Math.min(9, impact / 45));
      if (world.wanted.crimeCooldown <= 0) world.wanted.addCrime(5, world);
      scarePedestrians(world.pedestrians, x, y, 190);
      world.threat = { x, y };
    }
  },
  onHonk(car) { if (camera.isVisible(car.x, car.y, viewW, viewH, 200)) audio.honk(); },
  onWantedRise() { audio.wantedRise(); },
  onPlayerHurt() { camera.addShake(3); },
  onRespawn() { world.busted = false; camera.snapTo(world.player); },
  onPoliceContact(car, target, closingSpeed) {
    if (target.inCar) {
      if (closingSpeed > 30) { particles.sparks(target.x, target.y); camera.addShake(4); audio.crash(160); }
      if (Math.abs(world.player.inCar.speed) < 26) world.wanted.bustProgress += 0.016;
    } else if (Math.hypot(car.x - world.player.x, car.y - world.player.y) < 38) {
      world.wanted.bustProgress += 0.016;
    }
  },
  onBulletHitWall(b) { particles.sparks(b.x, b.y); },
  onGangHit(gang) { particles.bloodPuff(gang.x, gang.y); },
  onGangDown(gang) {
    particles.bloodPuff(gang.x, gang.y);
    world.player.money += 25;
    world.wanted.addCrime(8, world);
  },
  onGunshot(x, y, byPlayer) {
    particles.muzzle(x, y);
    if (camera.isVisible(x, y, viewW, viewH, 260)) audio.gunshot(byPlayer);
    scarePedestrians(world.pedestrians, x, y, 240);
    world.threat = { x, y };
  },
  onMissionComplete(def) {
    audio.cashJingle();
    world.totalEarned += def.reward;
    const p = world.playerTarget;
    particles.confetti(p.x, p.y - 10);
  },
  onLootGrabbed(marker) { particles.lootSparkle(marker.x, marker.y); audio.cashJingle(); },
};

world.missions = createMissionSystem(world);

// Restore a save (unless a screenshot scene is being staged).
const saved = shotName ? null : loadSave();
if (saved) {
  world.player.money = saved.money;
  world.missions.index = Math.min(saved.missionIndex, 5);
  world.missions.done = saved.storyDone;
  world.totalEarned = saved.totalEarned;
}

// ---------------------------------------------------------------- input
const keys = {};
const mouse = { x: 0, y: 0, down: false };
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  audio.unlock();
  if (world.state === 'title') {
    if (e.code === 'Enter') startGame(false);
    if (e.code === 'KeyN') startGame(true);
    return;
  }
  if (e.code === 'Enter' && world.dialogue.active) world.dialogue.advance();
  if (e.code === 'KeyE') toggleEnterExitCar();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', () => { mouse.down = true; audio.unlock(); });
window.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('click', () => {
  if (world.state === 'play' && world.dialogue.active) world.dialogue.advance();
});

function readInput() {
  return {
    up: !!(keys.KeyW || keys.ArrowUp), down: !!(keys.KeyS || keys.ArrowDown),
    left: !!(keys.KeyA || keys.ArrowLeft), right: !!(keys.KeyD || keys.ArrowRight),
    sprint: !!(keys.ShiftLeft || keys.ShiftRight), handbrake: !!keys.Space,
  };
}
// Exposed for automated play-tests: window.__palmCity = { world, keys }
window.__palmCity = { world, keys, startGame };

function startGame(fresh) {
  if (fresh) { clearSave(); world.missions.index = 0; world.missions.done = false; world.player.money = 120; }
  world.state = 'play';
  audio.click();
  if (!world.missions.done) world.missions.startCurrent();
  if (fresh || !saved) world.dialogue.start(STORY_INTRO, null);
  camera.snapTo(world.player);
}

function toggleEnterExitCar() {
  const player = world.player;
  if (player.inCar) {
    exitCar(player);
    audio.doorSlam();
    audio.setEngine(0, false);
  } else {
    const car = nearestEnterableCar(player, world.allCars);
    if (car) {
      const wasParked = car.parked;
      enterCar(player, car);
      audio.doorSlam(); audio.startEngine();
      if (wasParked && !car.isStealTarget) world.wanted.addCrime(14, world);
      if (car.isStealTarget) { world.wanted.addCrime(20, world); }
      if (car.traffic) { car.traffic = null; world.trafficCars = world.trafficCars.filter((c) => c !== car); }
    }
  }
}

// ---------------------------------------------------------------- shot scenes
function stageShotScene(name) {
  const p = world.player;
  world.missions.index = 1;
  if (name === 'cover') {
    world.fixedHour = 10.5;
    world.missions.index = 1;
    const car = world.parkedCars[0];
    car.x = 600; car.y = 891; car.angle = 0; car.vx = 175; car.vy = 0;
    enterCar(p, car);
    p.money = 640;
    world.wanted.heat = 30; world.wanted.stars = 2;
    placeTrafficAround(1250, 860, 6);
    placePedsAround(900, 860, 10);
    camera.snapTo(car);
  } else if (name === 'chase') {
    world.fixedHour = 14;
    world.missions.index = 3;
    const car = world.parkedCars[1];
    car.x = 430; car.y = 891; car.angle = 0; car.vx = 265; car.vy = 0;
    car.color = '#e74c3c';
    enterCar(p, car);
    p.money = 1130;
    world.wanted.heat = 62; world.wanted.stars = 4;
    for (let i = 0; i < 4; i++) {
      const cop = spawnPoliceCar({ x: car.x - 130 - i * 100, y: car.y + (i % 2 ? 34 : -30) }, world.policeCars, rng);
      cop.x = car.x - 130 - i * 100; cop.y = car.y + (i % 2 ? 34 : -30);
      cop.angle = 0; cop.vx = 245; cop.vy = 0;
    }
    placeTrafficAround(1250, 860, 3);
    placePedsAround(800, 860, 6);
    camera.snapTo(car);
  } else if (name === 'foot') {
    world.fixedHour = 16.5;
    world.missions.index = 4;
    p.x = 900; p.y = 1945; p.money = 1510;
    world.missions.gangSpawned = true;
    const { spawnGangPack } = stagingGang;
    world.gang.push(...spawnGangPack(1015, 1905, 3, ['Vex', 'Roxy', 'Juno']));
    world.gang[2].dead = true; world.gang[2].health = 0;
    world.gang[0].health = 26;
    p.aimAngle = Math.atan2(1885 - 1945, 1065 - 900);
    placePedsAround(920, 1980, 9);
    for (const ped of world.pedestrians.slice(0, 9)) ped.panic = 2;
    world.threat = { x: p.x, y: p.y };
    const carA = world.parkedCars[2]; carA.x = 800; carA.y = 2050; carA.angle = 0.4;
    const carB = world.parkedCars[3]; carB.x = 1080; carB.y = 1870; carB.angle = -0.3;
    camera.snapTo(p);
  } else if (name === 'night') {
    world.fixedHour = 20.6;
    world.missions.index = 5;
    world.missions.completeTimer = 3;
    world.missions.lastReward = 900;
    p.x = 905; p.y = 2075; p.money = 2960;
    p.health = 86;
    const car = world.parkedCars[4];
    car.x = 1010; car.y = 1995; car.angle = -0.5; car.color = '#ffd23f';
    placePedsAround(920, 1980, 12);
    placeTrafficAround(920, 1980, 6);
    particles.confetti(905, 2040);
    particles.confetti(860, 2100);
    camera.snapTo(p);
  }
  world.missions.startCurrent = () => {};
  // Freeze the wanted level exactly as staged: screenshot scenes must not
  // drift from 2 stars (cover) or 4 stars (chase) while the shutter waits.
  world.wanted.addCrime = () => {};
  if (statusEl) statusEl.textContent = 'Palm City Heist screenshot scene: ' + name;
}

// Gang staging helper kept static so the transcript shows the import graph.
import { spawnGangPack as stagingSpawnGangPack } from './combat.js';
const stagingGang = { spawnGangPack: stagingSpawnGangPack };

function placeTrafficAround(x, y, count) {
  let placed = 0;
  for (const car of world.trafficCars) {
    if (placed >= count) break;
    const t = car.traffic;
    const vertical = placed % 2 === 0;
    t.vertical = vertical;
    t.road = vertical ? nearestOf(VERTICAL_ROADS, x) : nearestOf(HORIZONTAL_ROADS, y);
    t.dir = placed % 4 < 2 ? 1 : -1;
    if (vertical) { car.x = t.road + t.dir * 31; car.y = y + (placed - count / 2) * 150; car.angle = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { car.y = t.road + t.dir * 31; car.x = x + (placed - count / 2) * 170; car.angle = t.dir > 0 ? 0 : Math.PI; }
    placed++;
  }
}
function nearestOf(list, v) { return list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), list[0]); }
function placePedsAround(x, y, count) {
  for (let i = 0; i < count && i < world.pedestrians.length; i++) {
    const ped = world.pedestrians[i];
    ped.x = x + ((i * 67) % 380) - 190;
    ped.y = y + ((i * 91) % 260) - 130;
  }
}

if (shotName) stageShotScene(shotName);
else camera.snapTo(world.player);

// ---------------------------------------------------------------- update
let lastTime = performance.now();
function gameLoop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (world.state === 'play') updateGame(dt);
  renderGame();
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

function updateGame(dt) {
  world.timeSeconds += dt;
  world.hour = world.fixedHour !== null ? world.fixedHour : (10.5 + world.timeSeconds / 22) % 24;
  const input = readInput();
  const player = world.player;
  const dialogueBusy = world.dialogue.active;
  world.dialogue.update(dt);

  if (player.dead) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) respawnPlayer(player, world);
  } else if (player.inCar) {
    const car = player.inCar;
    if (!dialogueBusy) updateCarPhysics(car, input, dt, city, world.effects);
    player.x = car.x; player.y = car.y;
    if (car.driftSmoke) particles.smoke(car.x - Math.cos(car.angle) * 24, car.y - Math.sin(car.angle) * 24);
    if (car.damageSmoke && Math.random() < dt * 8) particles.darkSmoke(car.x, car.y - 8);
    audio.setEngine(Math.abs(car.speed) / car.topSpeed, true);
  } else {
    if (!dialogueBusy) updatePlayerOnFoot(player, input, dt, city);
    audio.setEngine(0, false);
    // Shooting: mouse aim, click to fire.
    const target = cameraTarget();
    player.aimAngle = Math.atan2(target.y - player.y, target.x - player.x);
    world.shootCooldown -= dt;
    if (mouse.down && world.shootCooldown <= 0 && !dialogueBusy) {
      world.shootCooldown = 0.21;
      fireBullet(world.bullets, player.x + Math.cos(player.aimAngle) * 16, player.y + Math.sin(player.aimAngle) * 16, player.aimAngle, true);
      world.effects.onGunshot(player.x, player.y, true);
      world.wanted.addCrime(6, world);
    }
  }

  // Traffic, parked-car collisions, pedestrians, gang, bullets.
  const trafficWorld = { timeSeconds: world.timeSeconds, allCars: world.allCars, effects: world.effects, rng };
  for (const car of world.trafficCars) updateTrafficCar(car, dt, trafficWorld);
  resolveCarToCarCollisions();
  for (const ped of world.pedestrians) updatePedestrian(ped, dt, world);
  checkPedestrianRoadkill();
  for (const g of world.gang) updateGangMember(g, dt, world);
  updateBullets(world.bullets, dt, world);
  particles.update(dt);

  // Police: spawn to the wanted level, chase, bust checks.
  const wanted = world.wanted;
  const need = desiredPoliceCount(wanted.stars);
  if (world.policeCars.length < need && !player.dead) spawnPoliceCar(world.playerTarget, world.policeCars, rng);
  if (world.policeCars.length > Math.max(need, 0) + 1) world.policeCars.splice(0, world.policeCars.length - need - 1);
  let anyClose = false;
  for (const cop of world.policeCars) {
    const d = updatePoliceCar(cop, dt, world);
    if (d < 60) anyClose = true;
    if (cop.damageSmoke && Math.random() < dt * 6) particles.darkSmoke(cop.x, cop.y - 8);
  }
  audio.setSiren(world.policeCars.length > 0 && wanted.stars > 0);
  wanted.update(dt, policeSeesPlayer(world.policeCars, world.playerTarget));
  if (wanted.bustProgress > 0 && !anyClose) wanted.bustProgress = Math.max(0, wanted.bustProgress - dt * 0.7);
  if (wanted.bustProgress >= 1 && !player.dead) {
    wanted.bustProgress = 0;
    world.busted = true;
    player.dead = true; player.respawnTimer = 2.4; player.health = 0;
    if (player.inCar) { player.inCar.driver = null; player.inCar = null; }
  }

  // Missions and district tracking.
  if (!player.dead && !dialogueBusy) world.missions.update(dt);
  else if (world.missions.completeTimer > 0) world.missions.completeTimer -= dt;
  const district = districtAt(player.x, player.y);
  if (district !== world.currentDistrict) {
    world.currentDistrict = district;
    world.districtCardTimer = 2.6;
    if (statusEl) statusEl.textContent = 'Now entering ' + DISTRICTS[district].name;
  }
  world.districtCardTimer = Math.max(0, world.districtCardTimer - dt);

  const camTarget = player.inCar || player;
  camera.update(dt, camTarget);
}

function cameraTarget() {
  const left = camera.viewLeft(viewW), top = camera.viewTop(viewH);
  return { x: left + mouse.x, y: top + mouse.y };
}

function resolveCarToCarCollisions() {
  const cars = world.allCars.filter((c) => !c.parked || c === world.player.inCar);
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    const a = cars[i], b = cars[j];
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = 46;
    if (dist > 0.01 && dist < minDist) {
      const push = (minDist - dist) / 2;
      const nx = dx / dist, ny = dy / dist;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const relSpeed = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
      if (relSpeed > 55) {
        a.health -= relSpeed * 0.12; b.health -= relSpeed * 0.12;
        const playerInvolved = a === world.player.inCar || b === world.player.inCar;
        world.effects.onCarCrash(playerInvolved ? world.player.inCar : a, relSpeed, (a.x + b.x) / 2, (a.y + b.y) / 2);
        const swap = (a.vx - b.vx) * 0.4;
        a.vx -= nx * swap; a.vy -= ny * swap;
        b.vx += nx * swap; b.vy += ny * swap;
      }
    }
  }
  // Parked cars get nudged too.
  for (const parked of world.parkedCars) {
    if (parked === world.player.inCar) continue;
    const src = world.player.inCar;
    if (!src) continue;
    const dx = parked.x - src.x, dy = parked.y - src.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.01 && dist < 44) {
      parked.x += (dx / dist) * (44 - dist); parked.y += (dy / dist) * (44 - dist);
      particles.sparks(parked.x, parked.y);
    }
  }
}

function checkPedestrianRoadkill() {
  const src = world.player.inCar;
  if (!src || Math.abs(src.speed) < 60) return;
  for (const ped of world.pedestrians) {
    if (Math.hypot(ped.x - src.x, ped.y - src.y) < 26) {
      ped.panic = 3;
      ped.x += (ped.x - src.x) * 1.6; ped.y += (ped.y - src.y) * 1.6;
      world.wanted.addCrime(16, world);
      world.threat = { x: src.x, y: src.y };
      camera.addShake(3);
    }
  }
}

// ---------------------------------------------------------------- render
function renderGame() {
  ctx.fillStyle = '#20242c';
  ctx.fillRect(0, 0, viewW, viewH);
  const left = camera.viewLeft(viewW), top = camera.viewTop(viewH);
  ctx.save();
  ctx.translate(-left, -top);
  drawCityGround();
  drawRoads();
  drawParksAndBeach();
  drawBuildings();
  drawObjectiveMarker();
  for (const car of world.parkedCars) if (car !== world.player.inCar && camera.isVisible(car.x, car.y, viewW, viewH)) drawCarShape(ctx, car, false);
  for (const car of world.trafficCars) if (camera.isVisible(car.x, car.y, viewW, viewH)) drawCarShape(ctx, car, false);
  for (const ped of world.pedestrians) if (camera.isVisible(ped.x, ped.y, viewW, viewH)) drawPedestrian(ctx, ped, world.timeSeconds);
  for (const g of world.gang) drawGangMember(ctx, g);
  for (const cop of world.policeCars) drawCarShape(ctx, cop, false);
  if (world.player.inCar) drawCarShape(ctx, world.player.inCar, true);
  drawPlayerOnFoot(ctx, world.player, world.timeSeconds);
  drawBullets();
  particles.draw(ctx);
  drawEnterPrompt();
  ctx.restore();
  drawDayNightOverlay();
  if (world.state === 'play') {
    drawHud(ctx, world, viewW, viewH);
    drawMissionCompleteSplash(ctx, world, viewW, viewH);
    drawDialogueBox(ctx, world.dialogue, viewW, viewH);
    if (world.wanted.bustProgress > 0.12 && !world.player.dead) drawBustMeter();
    if (world.player.dead) drawWastedOverlay(ctx, world, viewW, viewH, world.busted);
  } else {
    // Title state still shows the living city behind the panel.
    drawTitleScreen(ctx, viewW, viewH, !!saved, world.timeSeconds);
  }
}

function drawCityGround() {
  ctx.fillStyle = '#93b184';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.fillStyle = DISTRICTS.downtown.ground;
  ctx.fillRect(0, 0, 1820, 1300);
  ctx.fillStyle = DISTRICTS.marina.ground;
  ctx.fillRect(1820, 0, WORLD_WIDTH - 1820, 1300);
  ctx.fillStyle = DISTRICTS.neon.ground;
  ctx.fillRect(0, 1300, 1820, 980);
  ctx.fillStyle = DISTRICTS.residential.ground;
  ctx.fillRect(1820, 1300, WORLD_WIDTH - 1820, 980);
  ctx.fillStyle = DISTRICTS.beach.ground;
  ctx.fillRect(0, 2280, WORLD_WIDTH, 200);
  // Sea: south bay and the marina inlet on the east.
  const seaGrad = ctx.createLinearGradient(0, 2480, 0, 2600);
  seaGrad.addColorStop(0, '#57b6d9'); seaGrad.addColorStop(1, '#2d7fb8');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, 2480, WORLD_WIDTH, 120);
  ctx.fillStyle = '#3d9bc4';
  ctx.fillRect(3460, 0, 140, 1300);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const y = 2500 + i * 9 + Math.sin(world.timeSeconds * 1.4 + i) * 2;
    ctx.beginPath(); ctx.moveTo((i * 331) % WORLD_WIDTH, y); ctx.lineTo((i * 331) % WORLD_WIDTH + 60, y); ctx.stroke();
  }
}

function drawRoads() {
  const left = camera.viewLeft(viewW), top = camera.viewTop(viewH);
  ctx.fillStyle = '#c7ccce';
  for (const rx of VERTICAL_ROADS) ctx.fillRect(rx - ROAD_WIDTH / 2 - 9, 0, ROAD_WIDTH + 18, WORLD_HEIGHT);
  for (const ry of HORIZONTAL_ROADS) ctx.fillRect(0, ry - ROAD_WIDTH / 2 - 9, WORLD_WIDTH, ROAD_WIDTH + 18);
  ctx.fillStyle = '#33373d';
  for (const rx of VERTICAL_ROADS) ctx.fillRect(rx - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD_HEIGHT);
  for (const ry of HORIZONTAL_ROADS) ctx.fillRect(0, ry - ROAD_WIDTH / 2, WORLD_WIDTH, ROAD_WIDTH);
  // Lane dashes.
  ctx.fillStyle = '#e8c33a';
  for (const rx of VERTICAL_ROADS) for (let y = 10; y < WORLD_HEIGHT; y += 46) ctx.fillRect(rx - 2, y, 4, 24);
  for (const ry of HORIZONTAL_ROADS) for (let x = 10; x < WORLD_WIDTH; x += 46) ctx.fillRect(x, ry - 2, 24, 4);
  void left; void top;
  // Crosswalks and traffic lights at every intersection.
  const phase = trafficLightPhase(world.timeSeconds);
  for (const rx of VERTICAL_ROADS) for (const ry of HORIZONTAL_ROADS) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(rx + i * 22 - 7, ry - ROAD_WIDTH / 2 - 16, 14, 9);
      ctx.fillRect(rx + i * 22 - 7, ry + ROAD_WIDTH / 2 + 7, 14, 9);
    }
    drawTrafficLight(rx - ROAD_WIDTH / 2 - 14, ry - ROAD_WIDTH / 2 - 14, phase === 'vertical');
    drawTrafficLight(rx + ROAD_WIDTH / 2 + 14, ry + ROAD_WIDTH / 2 + 14, phase === 'horizontal');
  }
}

function drawTrafficLight(x, y, green) {
  ctx.fillStyle = '#14181c';
  ctx.beginPath(); ctx.roundRect(x - 5, y - 9, 10, 18, 3); ctx.fill();
  ctx.fillStyle = green ? '#3dff6e' : '#ff4040';
  ctx.beginPath(); ctx.arc(x, y + (green ? 4 : -4), 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = green ? '#5a1f1f' : '#1f4d2a';
  ctx.beginPath(); ctx.arc(x, y + (green ? -4 : 4), 3.4, 0, Math.PI * 2); ctx.fill();
}

function drawParksAndBeach() {
  for (const park of city.parks) {
    ctx.fillStyle = '#6fae5f';
    ctx.beginPath(); ctx.roundRect(park.x, park.y, park.w, park.h, 14); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(park.name.toUpperCase(), park.x + park.w / 2, park.y + 22);
    for (const tree of park.trees) drawPalmTree(tree.x, tree.y, 1);
  }
  for (const palm of city.palms) drawPalmTree(palm.x, palm.y, palm.s);
  // Marina docks and boats.
  for (const dock of city.docks) {
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(dock.x, dock.y, dock.w, dock.h);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect(dock.x + dock.w - 58, dock.y - 8, 44, 16, 6); ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(dock.x + dock.w - 58, dock.y + 4, 44, 4);
  }
}

function drawPalmTree(x, y, s) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(2, 4, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(3, -4, 5, -12); ctx.stroke();
  ctx.strokeStyle = '#2e9e4f'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    ctx.beginPath(); ctx.moveTo(5, -12);
    ctx.quadraticCurveTo(5 + Math.cos(a) * 12, -16 + Math.sin(a) * 5, 5 + Math.cos(a) * 19, -10 + Math.sin(a) * 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBuildings() {
  const night = isNight();
  for (const b of city.buildings) {
    if (!camera.isVisible(b.x + b.w / 2, b.y + b.h / 2, viewW, viewH, Math.max(b.w, b.h))) continue;
    // Drop shadow sells the tower height downtown.
    const lift = b.district === 'downtown' ? 14 : 6;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.roundRect(b.x + lift, b.y + lift, b.w, b.h, 5); ctx.fill();
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 5); ctx.fill();
    if (b.kind === 'house') {
      ctx.fillStyle = b.roof;
      ctx.beginPath(); ctx.roundRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16, 4); ctx.fill();
      ctx.fillStyle = '#fff8e6';
      ctx.fillRect(b.x + b.w / 2 - 7, b.y + b.h / 2 - 5, 14, 12);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath(); ctx.roundRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12, 4); ctx.fill();
      // Window grid; windows glow at night.
      const cols = Math.max(2, Math.floor(b.w / 26)), rows = Math.max(2, Math.floor(b.h / 24));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const lit = ((i * 7 + j * 13 + Math.floor(b.x)) % 5) === 0;
        ctx.fillStyle = night ? (lit ? '#ffd873' : '#2c3e50') : '#bfe6f2';
        ctx.fillRect(b.x + 10 + i * ((b.w - 20) / cols), b.y + 10 + j * ((b.h - 20) / rows), 9, 7);
      }
      if (b.kind === 'club' && b.name) {
        ctx.fillStyle = b.signColor || '#ff4fd8';
        ctx.font = 'bold 21px system-ui, sans-serif'; ctx.textAlign = 'center';
        if (night) { ctx.shadowColor = b.signColor; ctx.shadowBlur = 16; }
        ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 7);
        ctx.shadowBlur = 0;
      } else if (b.name) {
        ctx.fillStyle = 'rgba(20,26,34,0.8)';
        ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(b.name, b.x + b.w / 2, b.y + 15);
      }
      if (b.district === 'downtown') {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(b.floors + 'F', b.x + b.w - 8, b.y + 14);
      }
    }
  }
  // Landmark labels.
  ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
  for (const lm of city.landmarks) {
    if (!camera.isVisible(lm.x, lm.y, viewW, viewH, 200)) continue;
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    const w = ctx.measureText(lm.name).width + 18;
    ctx.beginPath(); ctx.roundRect(lm.x - w / 2, lm.y - 108, w, 22, 6); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(lm.name, lm.x, lm.y - 92);
  }
}

function drawObjectiveMarker() {
  const marker = world.missions.markerPosition();
  if (!marker || world.state !== 'play') return;
  const t = world.timeSeconds;
  const pulse = 1 + Math.sin(t * 4.4) * 0.16;
  ctx.save();
  // Light pillar so the goal reads from across the city.
  const grad = ctx.createLinearGradient(0, marker.y - 190, 0, marker.y);
  grad.addColorStop(0, 'rgba(255,210,63,0)');
  grad.addColorStop(1, 'rgba(255,210,63,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(marker.x - 13, marker.y - 190, 26, 190);
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.ellipse(marker.x, marker.y, 34 * pulse, 15 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  const bobY = marker.y - 66 + Math.sin(t * 4.4) * 6;
  ctx.moveTo(marker.x, bobY + 16); ctx.lineTo(marker.x - 11, bobY); ctx.lineTo(marker.x + 11, bobY);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBullets() {
  for (const b of world.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.angle);
    ctx.fillStyle = 'rgba(255,230,109,0.45)';
    ctx.fillRect(-13, -3.4, 26, 6.8);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(-9, -1.8, 18, 3.6);
    ctx.restore();
  }
}

function drawEnterPrompt() {
  const player = world.player;
  if (player.inCar || player.dead || world.state !== 'play') return;
  const car = nearestEnterableCar(player, world.allCars);
  if (!car) return;
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,20,0.8)';
  const label = car.isStealTarget ? 'E — STEAL THIS CAR' : 'E — ENTER CAR';
  ctx.font = 'bold 14px system-ui, sans-serif';
  const w = ctx.measureText(label).width + 20;
  ctx.beginPath(); ctx.roundRect(car.x - w / 2, car.y - 46, w, 24, 6); ctx.fill();
  ctx.fillStyle = '#ffd23f'; ctx.textAlign = 'center';
  ctx.fillText(label, car.x, car.y - 29);
  ctx.restore();
}

function isNight() { return world.hour >= 19.2 || world.hour < 5.6; }

function drawDayNightOverlay() {
  const h = world.hour;
  let darkness = 0, warmth = 0;
  if (h >= 19.2 || h < 5.6) darkness = 0.36;
  else if (h >= 17.4) { darkness = 0.16; warmth = 0.15; }
  else if (h >= 16.2) warmth = 0.09;
  else if (h < 7) darkness = 0.14;
  if (darkness > 0) {
    ctx.fillStyle = `rgba(16,24,66,${darkness})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }
  if (warmth > 0) {
    ctx.fillStyle = `rgba(255,132,44,${warmth})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }
  if (isNight()) {
    // Neon glow pools on the strip.
    const left = camera.viewLeft(viewW), top = camera.viewTop(viewH);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of city.buildings) {
      if (b.kind !== 'club') continue;
      const sx = b.x + b.w / 2 - left, sy = b.y + b.h / 2 - top;
      if (sx < -120 || sy < -120 || sx > viewW + 120 || sy > viewH + 120) continue;
      const grad = ctx.createRadialGradient(sx, sy, 6, sx, sy, 120);
      const color = b.signColor || '#ff4fd8';
      grad.addColorStop(0, color + '55');
      grad.addColorStop(1, color + '00');
      ctx.fillStyle = grad;
      ctx.fillRect(sx - 120, sy - 120, 240, 240);
    }
    ctx.restore();
  }
}

function drawBustMeter() {
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,20,0.7)';
  ctx.beginPath(); ctx.roundRect(viewW / 2 - 130, viewH - 130, 260, 34, 8); ctx.fill();
  ctx.fillStyle = '#3d7bff';
  ctx.fillRect(viewW / 2 - 120, viewH - 118, 240 * Math.min(1, world.wanted.bustProgress), 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('BUSTED IN… MOVE!', viewW / 2, viewH - 122 + 26);
  ctx.restore();
}
