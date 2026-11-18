// audio-synth.js — every sound in Palm City Heist is synthesised with
// WebAudio oscillators and noise buffers: engine hum, police siren, gunshots,
// honks, cash register reward jingles and UI clicks. No audio files.

export function createAudioSynth() {
  let ctx = null;
  let engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, sirenLfo = null;
  function ensureContext() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { ctx = null; }
    return ctx;
  }
  function tone(freq, dur, type = 'square', vol = 0.12, slideTo = null, delay = 0) {
    const ac = ensureContext(); if (!ac) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator(), gain = ac.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function noiseBurst(dur, vol = 0.2, freq = 1200, delay = 0) {
    const ac = ensureContext(); if (!ac) return;
    const t0 = ac.currentTime + delay;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource(); src.buffer = buffer;
    const filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = freq;
    const gain = ac.createGain(); gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t0);
  }
  return {
    unlock() { ensureContext(); },
    click() { tone(660, 0.06, 'square', 0.06); },
    honk() { tone(340, 0.16, 'sawtooth', 0.07); tone(428, 0.16, 'sawtooth', 0.05); },
    gunshot(byPlayer) { noiseBurst(0.12, byPlayer ? 0.28 : 0.16, 2600); tone(150, 0.09, 'square', 0.1, 60); },
    crash(strength) { noiseBurst(0.22, Math.min(0.4, 0.1 + strength / 900), 800); tone(90, 0.2, 'triangle', 0.16, 40); },
    cashJingle() { tone(880, 0.1, 'square', 0.1); tone(1174, 0.1, 'square', 0.1, null, 0.09); tone(1568, 0.22, 'square', 0.12, null, 0.18); },
    wantedRise() { tone(196, 0.16, 'sawtooth', 0.1); tone(185, 0.22, 'sawtooth', 0.1, null, 0.14); },
    doorSlam() { tone(120, 0.08, 'square', 0.12, 60); noiseBurst(0.05, 0.1, 900); },
    startEngine() { tone(70, 0.4, 'sawtooth', 0.12, 160); },
    setEngine(speedRatio, active) {
      const ac = ensureContext(); if (!ac) return;
      if (active && !engineOsc) {
        engineOsc = ac.createOscillator(); engineGain = ac.createGain();
        engineOsc.type = 'sawtooth'; engineGain.gain.value = 0.0;
        const filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420;
        engineOsc.connect(filter).connect(engineGain).connect(ac.destination);
        engineOsc.start();
      }
      if (engineOsc) {
        engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, ac.currentTime, 0.06);
        engineGain.gain.setTargetAtTime(active ? 0.045 + speedRatio * 0.03 : 0, ac.currentTime, 0.1);
      }
    },
    setSiren(active) {
      const ac = ensureContext(); if (!ac) return;
      if (active && !sirenOsc) {
        sirenOsc = ac.createOscillator(); sirenGain = ac.createGain(); sirenLfo = ac.createOscillator();
        const lfoGain = ac.createGain();
        sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 840;
        sirenLfo.frequency.value = 0.65; lfoGain.gain.value = 190;
        sirenLfo.connect(lfoGain).connect(sirenOsc.frequency);
        sirenGain.gain.value = 0.0;
        sirenOsc.connect(sirenGain).connect(ac.destination);
        sirenOsc.start(); sirenLfo.start();
      }
      if (sirenGain) sirenGain.gain.setTargetAtTime(active ? 0.028 : 0, ac.currentTime, 0.15);
    },
  };
}
