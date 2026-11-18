// camera.js — the follow camera of Palm City Heist: smooth tracking with
// velocity look-ahead (it leans into the drive so corners feel readable),
// plus impact screen shake, clamped to the city bounds.

import { clampValue } from './rng.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from './world-city.js';

export function createCamera(viewWidth, viewHeight) {
  return {
    x: 0, y: 0, shake: 0, shakeX: 0, shakeY: 0,
    snapTo(target) {
      this.x = target.x; this.y = target.y;
    },
    addShake(amount) { this.shake = Math.min(15, this.shake + amount); },
    update(dt, target) {
      // Look ahead along the target's velocity — borrowed from classic
      // motion-timeline practice: anticipation sells speed.
      const leadX = (target.vx || 0) * 0.42, leadY = (target.vy || 0) * 0.42;
      const goalX = target.x + leadX, goalY = target.y + leadY;
      const stiffness = 1 - Math.pow(0.0015, dt);
      this.x += (goalX - this.x) * stiffness;
      this.y += (goalY - this.y) * stiffness;
      if (this.shake > 0.1) {
        this.shakeX = (Math.random() - 0.5) * 2 * this.shake;
        this.shakeY = (Math.random() - 0.5) * 2 * this.shake;
        this.shake *= Math.pow(0.001, dt);
      } else { this.shakeX = 0; this.shakeY = 0; this.shake = 0; }
    },
    viewLeft(viewW) {
      return clampValue(this.x - viewW / 2, 0, Math.max(0, WORLD_WIDTH - viewW)) + this.shakeX;
    },
    viewTop(viewH) {
      return clampValue(this.y - viewH / 2, 0, Math.max(0, WORLD_HEIGHT - viewH)) + this.shakeY;
    },
    worldToScreen(wx, wy, viewW, viewH) {
      return { x: wx - this.viewLeft(viewW), y: wy - this.viewTop(viewH) };
    },
    isVisible(wx, wy, viewW, viewH, margin = 90) {
      const sx = wx - this.viewLeft(viewW), sy = wy - this.viewTop(viewH);
      return sx > -margin && sy > -margin && sx < viewW + margin && sy < viewH + margin;
    },
    voidArgs: [viewWidth, viewHeight],
  };
}
