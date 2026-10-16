/** Small Web Audio helpers shared by the instruments. */

type AudioContextCtor = typeof AudioContext;

/**
 * Called from a tap or click (the context starts there). On iPhones, Web Audio
 * is muted by the ring/silent switch unless the page says it's playing media.
 */
export function createAudioContext(): AudioContext {
  playThroughSilentSwitch();
  const Ctor: AudioContextCtor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: AudioContextCtor }).webkitAudioContext;
  return new Ctor();
}

let mediaSessionClaimed = false;

/**
 * iOS 17+ exposes navigator.audioSession: asking for "playback" makes sound play
 * like a music app. Older iOS has no such switch, but a looping silent <audio>
 * element puts the page in the same playback category.
 */
function playThroughSilentSwitch(): void {
  if (mediaSessionClaimed) return;
  mediaSessionClaimed = true;
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) {
    try {
      session.type = 'playback';
    } catch {
      /* not allowed here; nothing else to try */
    }
    return;
  }
  const iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!iOS) return;
  const silence = document.createElement('audio');
  silence.setAttribute('x-webkit-airplay', 'deny');
  silence.preload = 'auto';
  silence.loop = true;
  silence.src = URL.createObjectURL(silentWav());
  silence.play().catch(() => {
    /* blocked: the page still plays, just subject to the silent switch */
  });
}

/** A tenth of a second of 8 kHz mono silence as a WAV file. */
function silentWav(): Blob {
  const samples = 800;
  const view = new DataView(new ArrayBuffer(44 + samples));
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + samples, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, 'data'); view.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) view.setUint8(44 + i, 128); // 8-bit PCM silence sits at the midpoint
  return new Blob([view], { type: 'audio/wav' });
}

/** A synthetic reverb impulse: stereo noise with an exponential-ish decay tail. */
export function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}

/** One second-ish of white noise, reused for strike transients. */
export function makeNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
