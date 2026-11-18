// particles.js — hand-rolled particle effects for Palm City Heist: crash
// sparks, drift smoke, muzzle flashes, confetti for mission complete, loot
// sparkle and dust. No library, just canvas circles with lifetimes.

export function createParticleSystem() {
  return {
    list: [],
    burst(x, y, options) {
      const count = options.count || 12;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (options.speed || 120) * (0.3 + Math.random() * 0.9);
        this.list.push({
          x, y,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (options.lift || 0),
          life: 0, maxLife: (options.life || 0.6) * (0.6 + Math.random() * 0.7),
          size: (options.size || 3) * (0.6 + Math.random() * 0.8),
          color: options.colors[Math.floor(Math.random() * options.colors.length)],
          gravity: options.gravity || 0, drag: options.drag || 0,
          shape: options.shape || 'circle', spin: (Math.random() - 0.5) * 9,
        });
      }
    },
    sparks(x, y) { this.burst(x, y, { count: 16, speed: 240, life: 0.45, size: 2.6, colors: ['#ffd23f', '#ff9f43', '#ffffff'] }); },
    smoke(x, y) { this.burst(x, y, { count: 2, speed: 26, life: 0.8, size: 6, colors: ['rgba(220,220,220,0.5)', 'rgba(180,180,180,0.4)'], lift: 14 }); },
    darkSmoke(x, y) { this.burst(x, y, { count: 3, speed: 30, life: 1, size: 7, colors: ['rgba(60,60,60,0.55)', 'rgba(90,90,90,0.45)'], lift: 22 }); },
    confetti(x, y) { this.burst(x, y, { count: 70, speed: 260, life: 1.6, size: 4.4, colors: ['#ff4fd8', '#22e6ff', '#ffd23f', '#7dff5a', '#ff7a3f'], gravity: 190, drag: 1.4, shape: 'rect' }); },
    muzzle(x, y) { this.burst(x, y, { count: 5, speed: 90, life: 0.14, size: 3.4, colors: ['#ffe66d', '#ffb84d'] }); },
    bloodPuff(x, y) { this.burst(x, y, { count: 8, speed: 110, life: 0.4, size: 3, colors: ['#c0392b', '#e74c3c'] }); },
    lootSparkle(x, y) { this.burst(x, y, { count: 26, speed: 150, life: 0.9, size: 3.2, colors: ['#7dff5a', '#ffd23f', '#ffffff'], lift: 40 }); },
    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.life += dt;
        if (p.life >= p.maxLife) { this.list.splice(i, 1); continue; }
        p.vy += p.gravity * dt;
        if (p.drag) { p.vx -= p.vx * p.drag * dt; p.vy -= p.vy * p.drag * dt; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    },
    draw(ctx) {
      for (const p of this.list) {
        const t = 1 - p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, t * 1.4));
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.life * p.spin);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.5), 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    },
  };
}
