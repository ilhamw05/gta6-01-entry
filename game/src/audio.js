// Procedural WebAudio for Solano Vice: engine hum, sirens, horns, punches and stings —
// everything is synthesized, no audio files and no network. The context is created on the
// first user gesture; in screenshot mode it is never created at all.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(context.destination);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 800;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenLfo = context.createOscillator();
      sirenLfo.type = 'sine';
      sirenLfo.frequency.value = 0.9;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 320;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(context.destination);
      sirenOsc.start();
      sirenLfo.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
      const gain = context.createGain();
      gain.gain.setValueAtTime(vol, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + dur);
    } catch {
      // Audio is decoration; a failure never breaks the game.
    }
  }

  return {
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
    },
    setMuted(value) {
      muted = value;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
    },
    /** Engine hum follows the driven car's speed; silent on foot. */
    engine(speed, driving) {
      if (!context || muted) return;
      const target = driving ? 0.05 + Math.min(0.1, Math.abs(speed) / 560 * 0.1) : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.16, context.currentTime, 0.08);
    },
    siren(wanted) {
      if (!context || muted) return;
      sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.035 : 0, context.currentTime, 0.3);
    },
    horn() {
      blip(220, 0.35, 'square', 0.12);
      blip(277, 0.35, 'square', 0.1);
    },
    punch() {
      blip(140, 0.12, 'sawtooth', 0.2, 60);
    },
    hit() {
      blip(90, 0.2, 'sawtooth', 0.22, 45);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.16);
      setTimeout(() => blip(880, 0.18, 'sine', 0.16), 90);
    },
    missionWin() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'triangle', 0.18), i * 110));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'triangle', 0.16), i * 140));
    },
    busted() {
      [330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.4, 'sawtooth', 0.14), i * 180));
    },
  };
}
