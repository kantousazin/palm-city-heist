// world-city.js — generates Palmera City: the road grid, four-plus distinct
// districts, buildings, parks, the beach and the marina of Palm City Heist.
// Everything is procedural and seeded; no image assets are used at all.

import { createSeededRandom, pickFrom, randomRange } from './rng.js';

export const WORLD_WIDTH = 3600;
export const WORLD_HEIGHT = 2600;
export const ROAD_WIDTH = 124;
export const VERTICAL_ROADS = [320, 920, 1520, 2120, 2720, 3320];
export const HORIZONTAL_ROADS = [300, 860, 1420, 1980, 2400];

export const DISTRICTS = {
  downtown: { name: 'DOWNTOWN', ground: '#9aa3a8', sidewalk: '#c7ccce' },
  marina: { name: 'MARINA', ground: '#a8b39a', sidewalk: '#d8d2bd' },
  neon: { name: 'NEON STRIP', ground: '#7d7f92', sidewalk: '#b9b7c9' },
  residential: { name: 'PALM HEIGHTS', ground: '#93b184', sidewalk: '#cfd6bd' },
  beach: { name: 'SOLANA BEACH', ground: '#ecd9a0', sidewalk: '#f2e3b3' },
};

const DOWNTOWN_PALETTE = ['#5b6b7d', '#6d7f92', '#4d5d70', '#7c8a99', '#66788c', '#54687c'];
const MARINA_PALETTE = ['#e8e2d2', '#dfe7ea', '#cfe0da', '#f0e8d8', '#d8e2e8'];
const NEON_PALETTE = ['#4a3f66', '#5d4a7a', '#3e4a6b', '#6b4470', '#54456e'];
const HOUSE_PALETTE = ['#e8c9a0', '#f0dcc0', '#dcc7e8', '#c7e0c0', '#f2e0b8', '#e8b8a8'];
export const NEON_SIGNS = ['LUNA', 'VELVET', 'CASINO', 'ORBIT', 'PALMS', 'DISCO', 'HOTEL', 'BAR 9'];
export const SHOP_NAMES = ['Cafe Sol', 'Taco Mar', 'Pharmacy', 'Book Nook', 'Surf Shop', 'Bakery', 'Bank of Palm', 'Gym 24', 'Diner', 'Florist'];

export function districtAt(x, y) {
  if (y > 2280) return 'beach';
  if (x < 1820 && y < 1300) return 'downtown';
  if (x >= 1820 && y < 1300) return 'marina';
  if (x < 1820 && y >= 1300) return 'neon';
  return 'residential';
}

export function isOnRoad(x, y) {
  for (const rx of VERTICAL_ROADS) if (Math.abs(x - rx) < ROAD_WIDTH / 2) return true;
  for (const ry of HORIZONTAL_ROADS) if (Math.abs(y - ry) < ROAD_WIDTH / 2) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = { x, y }, bestDist = Infinity;
  for (const rx of VERTICAL_ROADS) {
    const d = Math.abs(x - rx);
    if (d < bestDist) { bestDist = d; best = { x: rx, y }; }
  }
  for (const ry of HORIZONTAL_ROADS) {
    const d = Math.abs(y - ry);
    if (d < bestDist) { bestDist = d; best = { x, y: ry }; }
  }
  return best;
}

function buildBlockBuildings(rng, buildings, x0, y0, x1, y1, district) {
  const margin = 26;
  const bx = x0 + margin, by = y0 + margin;
  const bw = x1 - x0 - margin * 2, bh = y1 - y0 - margin * 2;
  if (bw < 90 || bh < 90) return;
  if (district === 'residential') {
    // Small detached houses with gardens, two rows per block.
    const cols = Math.max(2, Math.floor(bw / 150));
    const rows = Math.max(2, Math.floor(bh / 150));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      buildings.push({
        x: bx + (i + 0.5) * (bw / cols) - 42, y: by + (j + 0.5) * (bh / rows) - 32,
        w: 84, h: 64, district, kind: 'house',
        color: pickFrom(rng, HOUSE_PALETTE), roof: pickFrom(rng, ['#b0563a', '#8a6a4a', '#6a7d8c', '#a05248']),
        floors: 1, name: '',
      });
    }
    return;
  }
  const cols = district === 'downtown' ? 2 : 2;
  const rows = 2;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const w = bw / cols - 22, h = bh / rows - 22;
    const b = {
      x: bx + i * (bw / cols) + 11, y: by + j * (bh / rows) + 11, w, h, district,
      kind: district === 'downtown' ? 'tower' : district === 'neon' ? 'club' : 'shop',
      color: '', roof: '', floors: 1, name: '',
    };
    if (district === 'downtown') {
      b.color = pickFrom(rng, DOWNTOWN_PALETTE);
      b.floors = 6 + Math.floor(rng() * 9);
    } else if (district === 'neon') {
      b.color = pickFrom(rng, NEON_PALETTE);
      b.floors = 2 + Math.floor(rng() * 3);
      b.name = pickFrom(rng, NEON_SIGNS);
      b.signColor = pickFrom(rng, ['#ff4fd8', '#22e6ff', '#ffd23f', '#7dff5a', '#ff7a3f']);
    } else if (district === 'marina') {
      b.color = pickFrom(rng, MARINA_PALETTE);
      b.floors = 1 + Math.floor(rng() * 3);
      b.name = pickFrom(rng, SHOP_NAMES);
    } else {
      b.color = pickFrom(rng, HOUSE_PALETTE);
      b.floors = 1 + Math.floor(rng() * 2);
      b.name = pickFrom(rng, SHOP_NAMES);
    }
    buildings.push(b);
  }
}

export function generateCity(seed) {
  const rng = createSeededRandom(seed * 7919 + 13);
  const buildings = [];
  const xs = [-40, ...VERTICAL_ROADS.map((v) => v + ROAD_WIDTH / 2), WORLD_WIDTH + 40];
  const ys = [-40, ...HORIZONTAL_ROADS.map((v) => v + ROAD_WIDTH / 2), WORLD_HEIGHT + 40];
  const xEdges = [-40];
  for (const v of VERTICAL_ROADS) { xEdges.push(v - ROAD_WIDTH / 2, v + ROAD_WIDTH / 2); }
  xEdges.push(WORLD_WIDTH + 40);
  const yEdges = [-40];
  for (const v of HORIZONTAL_ROADS) { yEdges.push(v - ROAD_WIDTH / 2, v + ROAD_WIDTH / 2); }
  yEdges.push(WORLD_HEIGHT + 40);
  void xs; void ys;
  for (let i = 0; i < xEdges.length - 1; i += 2) {
    for (let j = 0; j < yEdges.length - 1; j += 2) {
      const x0 = xEdges[i], x1 = xEdges[i + 1], y0 = yEdges[j], y1 = yEdges[j + 1];
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      if (district === 'beach') continue;
      buildBlockBuildings(rng, buildings, x0, y0, x1, y1, district);
    }
  }
  // Parks: green rectangles with palm trees in three districts.
  const parks = [
    { x: 1080, y: 1020, w: 300, h: 220, name: 'Solano Park' },
    { x: 2280, y: 1580, w: 300, h: 220, name: 'Palm Court' },
    { x: 480, y: 1580, w: 280, h: 200, name: 'Neon Garden' },
  ];
  for (const park of parks) {
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i];
      if (b.x < park.x + park.w && b.x + b.w > park.x && b.y < park.y + park.h && b.y + b.h > park.y) buildings.splice(i, 1);
    }
    park.trees = [];
    for (let t = 0; t < 14; t++) park.trees.push({ x: park.x + 24 + rng() * (park.w - 48), y: park.y + 24 + rng() * (park.h - 48) });
  }
  // Palm trees scattered along the beach and sidewalks.
  const palms = [];
  for (let x = 80; x < WORLD_WIDTH - 60; x += 130) palms.push({ x: x + rng() * 40, y: 2330 + rng() * 30, s: randomRange(rng, 0.8, 1.25) });
  // Marina docks on the east side of the marina district.
  const docks = [];
  for (let i = 0; i < 5; i++) docks.push({ x: 3180, y: 420 + i * 170, w: 260, h: 26 });
  const landmarks = [
    { x: 920, y: 860, name: 'Palm City Bank', kind: 'bank' },
    { x: 2720, y: 860, name: 'Marina Dock', kind: 'dock' },
    { x: 920, y: 1980, name: 'Club Luna', kind: 'club' },
    { x: 2720, y: 1980, name: 'Solano Hideout', kind: 'hideout' },
    { x: 1520, y: 300, name: 'Cafe Sol', kind: 'cafe' },
    { x: 3320, y: 1420, name: 'Depot Garage', kind: 'garage' },
  ];
  return { buildings, parks, palms, docks, landmarks, rng };
}

export function buildingAtPoint(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

export function resolveBuildingCollision(city, x, y, radius) {
  // Push a circle out of every building it overlaps; returns corrected point.
  let px = x, py = y;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(px, b.x + b.w));
    const ny = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - nx, dy = py - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 < 0.01) { py = b.y - radius; continue; }
      const d = Math.sqrt(d2);
      px = nx + (dx / d) * radius;
      py = ny + (dy / d) * radius;
    }
  }
  return { x: px, y: py };
}
