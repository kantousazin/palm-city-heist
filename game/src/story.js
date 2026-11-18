// story.js — the story of Palm City Heist: Ren Solano, ex-delivery driver,
// takes one last string of jobs across Palmera City. All dialogue data and
// the typewriter dialogue box live here; missions.js drives the plot.

export const STORY_INTRO = [
  { who: 'REN', text: 'Palmera City. Six years delivering other people\'s packages, and I still can\'t pay rent.' },
  { who: 'MARA (phone)', text: 'Ren? It\'s Mara. I have work. Real money. Start with a simple delivery — Cafe Sol, north side.' },
  { who: 'REN', text: 'Simple. Sure. Nothing in this city is ever simple.' },
];

export const MISSION_DIALOGUE = {
  delivery: [
    { who: 'MARA (phone)', text: 'Pick up the package at Cafe Sol. The barista knows your face. Don\'t open it.' },
  ],
  wheels: [
    { who: 'MARA (phone)', text: 'The client\'s car is parked by the depot — a borrowed ride, let\'s say. Bring it to the marina.' },
    { who: 'REN', text: 'Borrowed. Right. If the alarm sings, I run.' },
  ],
  drop: [
    { who: 'DOCKMASTER', text: 'You Mara\'s driver? Leave the car by the boats. And Ren — the police are already sniffing around.' },
  ],
  heat: [
    { who: 'MARA (phone)', text: 'Ren, every patrol in Palm City is looking for you. Lose them. All of them. Now.' },
  ],
  neon: [
    { who: 'MARA (phone)', text: 'The Neon Wolves jumped our courier on the Strip. On foot, Ren. Make them regret it.' },
    { who: 'WOLF', text: 'Wrong street, delivery boy.' },
  ],
  heist: [
    { who: 'MARA (phone)', text: 'Last job. The Palm City Bank vault truck leaves at dusk. Grab the loot bag, then disappear to the hideout.' },
    { who: 'REN', text: 'One last job. Then I\'m done, Mara. Done.' },
  ],
  finale: [
    { who: 'MARA (phone)', text: 'You did it. The city is yours now, Ren. Spend it well — Palm City is still open for business.' },
  ],
};

export function createDialogueBox() {
  return {
    lines: [], index: 0, chars: 0, active: false, onDone: null,
    start(lines, onDone) {
      this.lines = lines; this.index = 0; this.chars = 0;
      this.active = lines.length > 0; this.onDone = onDone || null;
      if (!this.active && this.onDone) this.onDone();
    },
    current() { return this.active ? this.lines[this.index] : null; },
    update(dt) {
      if (!this.active) return;
      this.chars += dt * 46;
    },
    visibleText() {
      const line = this.current();
      if (!line) return '';
      return line.text.slice(0, Math.floor(this.chars));
    },
    advance() {
      if (!this.active) return;
      const line = this.current();
      if (this.chars < line.text.length) { this.chars = line.text.length; return; }
      this.index += 1; this.chars = 0;
      if (this.index >= this.lines.length) {
        this.active = false;
        if (this.onDone) { const cb = this.onDone; this.onDone = null; cb(); }
      }
    },
  };
}

export function drawDialogueBox(ctx, box, width, height) {
  const line = box.current();
  if (!line) return;
  const boxW = Math.min(760, width - 60), boxH = 104;
  const x = (width - boxW) / 2, y = height - boxH - 22;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,24,0.88)';
  ctx.beginPath(); ctx.roundRect(x, y, boxW, boxH, 12); ctx.fill();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, boxW, boxH, 12); ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(line.who, x + 18, y + 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = '19px system-ui, sans-serif';
  wrapText(ctx, box.visibleText(), x + 18, y + 38, boxW - 36, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('ENTER ▸', x + boxW - 14, y + boxH - 22);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '', cy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy); cy += lineHeight; line = word;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, cy);
}
