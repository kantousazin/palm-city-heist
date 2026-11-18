// save-game.js — Palm City Heist progress in localStorage: mission chain
// position, money, finished-story flag and best earnings. Versioned key, and
// every read is defensive so a corrupt save can never break the game.

const SAVE_KEY = 'palm-city-heist-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: Number.isFinite(data.money) ? data.money : 120,
      missionIndex: Number.isFinite(data.missionIndex) ? data.missionIndex : 0,
      storyDone: !!data.storyDone,
      totalEarned: Number.isFinite(data.totalEarned) ? data.totalEarned : 0,
    };
  } catch { return null; }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.player.money,
      missionIndex: state.missions.index,
      storyDone: state.missions.done,
      totalEarned: state.totalEarned || 0,
    }));
  } catch { /* storage unavailable: play on without saving */ }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function hasSave() {
  return loadSave() !== null;
}
