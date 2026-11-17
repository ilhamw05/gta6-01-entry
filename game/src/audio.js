// Procedural WebAudio sound: no files, only oscillators and filtered noise. The engine hums
// with the player's speed, police sirens wail two-tone when the law is close, and every
// little event in the city gets a blip. Everything is created lazily on the first user
// gesture (browsers refuse audio before one) and every call is safe before that moment.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenLfo = null;
  let sirenGain = null;
  let ambientGain = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
    startAmbient();
    return true;
  }

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function startAmbient() {
    // Low city wash: looped noise through a low-pass, breathing very slowly.
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2.5);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.015;
    src.connect(filter).connect(ambientGain).connect(master);
    src.start();
  }

  function blip(freqA, freqB, dur, type = 'sine', vol = 0.16, when = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseHit(dur, freq, vol) {
    if (!ensure()) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start();
  }

  /** Named one-shot sounds, keyed by the fx events the world emits. */
  function play(name) {
    if (!ensure()) return;
    switch (name) {
      case 'punch': noiseHit(0.08, 900, 0.12); break;
      case 'punchhit': noiseHit(0.12, 500, 0.22); blip(160, 60, 0.1, 'triangle', 0.2); break;
      case 'hurt': blip(220, 90, 0.18, 'sawtooth', 0.14); break;
      case 'crash': noiseHit(0.28, 700, 0.3); break;
      case 'cardestroyed': noiseHit(0.6, 300, 0.34); blip(90, 40, 0.5, 'sawtooth', 0.2); break;
      case 'hitped': noiseHit(0.15, 600, 0.25); break;
      case 'pickup': blip(880, 880, 0.07, 'sine', 0.16); blip(1318, 1318, 0.1, 'sine', 0.16, 0.07); break;
      case 'checkpoint': blip(660, 990, 0.09, 'square', 0.1); break;
      case 'go': blip(523, 523, 0.1, 'square', 0.14); blip(1046, 1046, 0.22, 'square', 0.14, 0.1); break;
      case 'horn': blip(233, 233, 0.22, 'square', 0.07); blip(294, 294, 0.22, 'square', 0.05); break;
      case 'enter': blip(330, 392, 0.07, 'triangle', 0.12); break;
      case 'exit': blip(392, 330, 0.07, 'triangle', 0.12); break;
      case 'missionstart': blip(392, 392, 0.09, 'triangle', 0.14); blip(587, 587, 0.12, 'triangle', 0.14, 0.09); break;
      case 'missiondone':
        [523, 659, 784, 1046].forEach((f, i) => blip(f, f, 0.14, 'triangle', 0.16, i * 0.09));
        break;
      case 'missionfail': blip(392, 392, 0.14, 'triangle', 0.14); blip(311, 233, 0.3, 'triangle', 0.14, 0.13); break;
      case 'busted': blip(196, 196, 0.16, 'square', 0.12); blip(147, 147, 0.3, 'square', 0.12, 0.15); break;
      case 'wasted': blip(330, 55, 0.9, 'sawtooth', 0.16); break;
      default: break;
    }
  }

  /** The player's engine: call every frame with speed ratio 0..1, or null when on foot. */
  function setEngine(ratio) {
    if (!ensure()) return;
    if (ratio === null) {
      if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      return;
    }
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineOsc2 = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc2.type = 'square';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 480;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain).connect(master);
      engineOsc.start();
      engineOsc2.start();
    }
    const f = 55 + ratio * 165;
    engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
    engineOsc2.frequency.setTargetAtTime(f * 0.5 + 2, ctx.currentTime, 0.05);
    engineGain.gain.setTargetAtTime(0.05 + ratio * 0.06, ctx.currentTime, 0.08);
  }

  /** Police siren: level 0..1 by the nearest unit's distance; silent at 0. */
  function setSiren(level) {
    if (!ensure()) return;
    if (level <= 0) {
      if (sirenGain) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      return;
    }
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 820;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 130;
      sirenLfo.connect(lfoGain).connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
      sirenLfo.start();
    }
    sirenGain.gain.setTargetAtTime(0.028 * level, ctx.currentTime, 0.2);
  }

  return { play, setEngine, setSiren, unlock: ensure };
}
