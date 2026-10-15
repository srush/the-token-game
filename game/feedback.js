export function createFeedback({ isSoundEnabled, reducedMotion = false, environment = globalThis }) {
  let audio;
  async function unlock() {
    if (!isSoundEnabled()) return null;
    try {
      const Context = environment.AudioContext || environment.webkitAudioContext;
      if (!Context) return null;
      // Safari exposes this optional API for playback-style audio routing.
      try {
        if (environment.navigator?.audioSession) environment.navigator.audioSession.type = 'playback';
      } catch { /* Unsupported session settings must not prevent sound. */ }
      if (!audio || audio.state === 'closed') audio = new Context();
      if (audio.state !== 'running') await audio.resume();
      return audio.state === 'running' ? audio : null;
    } catch { return null; }
  }
  async function tone(success) {
    const context = await unlock();
    if (!context || !isSoundEnabled()) return;
    try {
      const start = context.currentTime + .01;
      [0, .07, .14].slice(0, success ? 3 : 1).forEach((delay, i) => {
        const osc = context.createOscillator(), gain = context.createGain(), t = start + delay;
        osc.frequency.value = success ? [523.25, 659.25, 783.99][i] : 155;
        gain.gain.setValueAtTime(.0001, t);
        gain.gain.exponentialRampToValueAtTime(.075, t + .01);
        gain.gain.exponentialRampToValueAtTime(.0001, t + .16);
        osc.connect(gain); gain.connect(context.destination);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        osc.start(t); osc.stop(t + .18);
      });
    } catch { /* Optional feedback never blocks a move. */ }
  }
  function vibrate() {
    if (reducedMotion) return;
    try { environment.navigator?.vibrate?.(12); } catch { /* Unsupported device. */ }
  }
  return { unlock, tone, vibrate };
}
