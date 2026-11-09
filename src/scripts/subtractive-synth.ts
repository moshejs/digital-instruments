/**
 * SUBTRACTIVE SYNTH: a playable synthesizer built on the Web Audio API.
 * Per voice:     oscillator → lowpass filter → ADSR gain
 * Shared bus:    voices → dry + convolver reverb → master → limiter → out
 * Two AnalyserNode-fed canvases draw the live oscilloscope and spectrum.
 *
 * Ported from https://github.com/moshejs/subtractive-synth (MIT, © 2026 Moshe Malka).
 */
import { createAudioContext, makeImpulse } from '../lib/audio';
import { midiToFreq, midiToName } from '../lib/music';
import {
  MAX_OCTAVE, MIN_OCTAVE, PHONE_KEYS, PRESETS, SYNTH_KEYMAP, WAVE_NAME, WIDE_KEYS,
  clamp, fmtHz, fmtPct, fmtSec, hzToPos, keyMidi, layoutKeys, posToHz,
  type Patch, type PresetName, type Wave,
} from '../lib/synth';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const phone = window.matchMedia('(max-width: 520px)');

/* ───────────────────────────── state ───────────────────────────── */

const state: Patch & { master: number; octave: number } = { ...PRESETS.saw, master: 0.8, octave: 4 };

const VOICE_PEAK = 0.24; // per-voice ceiling so chords don't clip
const wetFromSpace = (space: number): number => space * 0.9;

/* ───────────────────────────── audio graph ───────────────────────────── */

interface Graph {
  ctx: AudioContext;
  busIn: GainNode;
  wet: GainNode;
  master: GainNode;
  analyser: AnalyserNode;
  timeData: Uint8Array<ArrayBuffer>;
  freqData: Uint8Array<ArrayBuffer>;
}
interface Voice {
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  amp: GainNode;
}

let audio: Graph | null = null; // created on the first gesture
const voices = new Map<number, Voice>(); // semitone offset → the note sounding there
let sculpting = false;

function resume(): void {
  if (audio && audio.ctx.state !== 'running') void audio.ctx.resume().then(updateEnable, updateEnable);
}

function ensureAudio(): Graph {
  if (audio) {
    resume();
    return audio;
  }
  const ctx = createAudioContext();

  const busIn = ctx.createGain(); // every voice lands here
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  wet.gain.value = wetFromSpace(state.space);
  const conv = ctx.createConvolver();
  conv.buffer = makeImpulse(ctx, 2.4, 2.4); // a decaying burst of noise, generated on the fly
  const master = ctx.createGain();
  master.gain.value = state.master;

  // a gentle limiter so aggressive patches and big chords can't clip nastily
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8;
  comp.knee.value = 6;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;

  // busIn splits into dry + reverb, which recombine at master
  busIn.connect(dry);
  dry.connect(master);
  busIn.connect(conv);
  conv.connect(wet);
  wet.connect(master);
  master.connect(comp);
  comp.connect(ctx.destination);
  master.connect(analyser); // the visualisers tap the master

  audio = {
    ctx, busIn, wet, master, analyser,
    timeData: new Uint8Array(analyser.fftSize),
    freqData: new Uint8Array(analyser.frequencyBinCount),
  };
  ctx.onstatechange = updateEnable;
  resume();
  updateEnable();
  return audio;
}

function createVoice(graph: Graph, semi: number): Voice {
  const { ctx } = graph;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = state.wave;
  osc.frequency.setValueAtTime(midiToFreq(keyMidi(state.octave, semi)), now);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(state.cutoff, now);
  filter.Q.setValueAtTime(state.res, now);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, now);

  osc.connect(filter);
  filter.connect(amp);
  amp.connect(graph.busIn);

  // attack → decay → sustain, ramped so there are no clicks
  const atk = Math.max(0.001, state.a);
  const dec = Math.max(0.001, state.d);
  amp.gain.linearRampToValueAtTime(VOICE_PEAK, now + atk);
  amp.gain.linearRampToValueAtTime(Math.max(0.0001, state.s * VOICE_PEAK), now + atk + dec);

  osc.start(now);
  return { osc, filter, amp };
}

function releaseVoice(graph: Graph, v: Voice): void {
  const now = graph.ctx.currentTime;
  const g = v.amp.gain;
  // hold whatever the envelope is at right now, then ramp down over the release
  if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now);
  else {
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
  }
  const rel = Math.max(0.005, state.r);
  g.linearRampToValueAtTime(0.0001, now + rel);
  v.osc.stop(now + rel + 0.03);
  v.osc.onended = () => {
    v.osc.disconnect();
    v.filter.disconnect();
    v.amp.disconnect();
  };
}

function noteOn(semi: number): void {
  const graph = ensureAudio();
  if (voices.has(semi)) return; // already sounding
  voices.set(semi, createVoice(graph, semi));
  lightKey(semi, true);
  startDraw();
}

function noteOff(semi: number): void {
  const v = voices.get(semi);
  if (!v || !audio) return;
  voices.delete(semi);
  releaseVoice(audio, v);
  lightKey(semi, false);
}

function releaseAll(): void {
  for (const semi of [...voices.keys()]) noteOff(semi);
  pointerNotes.clear();
}

/* ───────────────────────────── on-screen keyboard ───────────────────────────── */

const keyboard = $('keyboard');
const keyEls = new Map<number, HTMLButtonElement>();
const pointerNotes = new Map<number, number>(); // pointerId → semitone offset
const KEY_LABEL = new Map(Object.entries(SYNTH_KEYMAP).map(([k, semi]) => [semi, k.toUpperCase()]));

function buildKeyboard(): void {
  releaseAll();
  keyboard.replaceChildren();
  keyEls.clear();
  const geometry = layoutKeys(phone.matches ? PHONE_KEYS : WIDE_KEYS);
  // white keys first, so the black keys stack on top of them
  for (const k of [...geometry.filter((g) => !g.black), ...geometry.filter((g) => g.black)]) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `key ${k.black ? 'black' : 'white'}`;
    el.style.left = `${k.left}%`;
    el.style.width = `${k.width}%`;
    const label = KEY_LABEL.get(k.semi);
    if (label) {
      const lab = document.createElement('span');
      lab.className = 'lab kbd-hint';
      lab.textContent = label;
      el.append(lab);
    }
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pointerNotes.set(e.pointerId, k.semi);
      noteOn(k.semi);
    });
    el.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        noteOn(k.semi);
      }
    });
    el.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') noteOff(k.semi);
    });
    keyEls.set(k.semi, el);
    keyboard.append(el);
  }
  nameKeys();
}

function nameKeys(): void {
  for (const [semi, el] of keyEls) el.setAttribute('aria-label', midiToName(keyMidi(state.octave, semi)).replace('#', ' sharp '));
}

function lightKey(semi: number, on: boolean): void {
  keyEls.get(semi)?.classList.toggle('on', on);
}

// a pointer released anywhere releases whatever note it started
function endPointer(e: PointerEvent): void {
  const semi = pointerNotes.get(e.pointerId);
  if (semi !== undefined) {
    pointerNotes.delete(e.pointerId);
    noteOff(semi);
  }
}
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);
// a long press must not open the phone's context menu in the middle of a note
keyboard.addEventListener('contextmenu', (e) => e.preventDefault());

/* ───────────────────────────── computer keyboard ───────────────────────────── */

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  // sliders should still let you play; only genuine text entry keeps its keys
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'range'))) return;
  const k = e.key.toLowerCase();
  if (k === 'z') setOctave(state.octave - 1);
  else if (k === 'x') setOctave(state.octave + 1);
  else if (k in SYNTH_KEYMAP && !e.repeat) noteOn(SYNTH_KEYMAP[k]);
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k in SYNTH_KEYMAP) noteOff(SYNTH_KEYMAP[k]);
});

// never leave a note stuck when focus leaves the page
window.addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseAll();
});

function setOctave(octave: number): void {
  state.octave = clamp(octave, MIN_OCTAVE, MAX_OCTAVE);
  $('oct-val').textContent = String(state.octave);
  $<HTMLButtonElement>('oct-down').disabled = state.octave === MIN_OCTAVE;
  $<HTMLButtonElement>('oct-up').disabled = state.octave === MAX_OCTAVE;
  nameKeys();
  updateReadouts();
}

/* ───────────────────────────── controls ───────────────────────────── */

const waveButtons = document.querySelectorAll<HTMLButtonElement>('#waves button');
const presetButtons = document.querySelectorAll<HTMLButtonElement>('#presets button');
const slider = (id: string): HTMLInputElement => $<HTMLInputElement>(id);

function updateReadouts(): void {
  $('cutoff-val').textContent = fmtHz(state.cutoff);
  $('resonance-val').textContent = state.res.toFixed(1);
  $('attack-val').textContent = fmtSec(state.a);
  $('decay-val').textContent = fmtSec(state.d);
  $('sustain-val').textContent = fmtPct(state.s);
  $('release-val').textContent = fmtSec(state.r);
  $('space-val').textContent = fmtPct(state.space);
  $('master-val').textContent = fmtPct(state.master);
  // the live signal-chain readout
  $('chain-osc').textContent = `${WAVE_NAME[state.wave]} · oct ${state.octave}`;
  $('chain-filter').textContent = `Lowpass ${fmtHz(state.cutoff)} · Q ${state.res.toFixed(1)}`;
  $('chain-env').textContent = `A ${fmtSec(state.a)} · S ${fmtPct(state.s)} · R ${fmtSec(state.r)}`;
  $('chain-space').textContent = `Reverb ${fmtPct(state.space)}`;
}

/** Push the slider positions and waveform buttons to match the state, then refresh the readouts. */
function syncControls(): void {
  waveButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.wave === state.wave)));
  slider('cutoff').value = String(hzToPos(state.cutoff));
  slider('resonance').value = String(state.res);
  slider('attack').value = String(state.a);
  slider('decay').value = String(state.d);
  slider('sustain').value = String(state.s);
  slider('release').value = String(state.r);
  slider('space').value = String(state.space);
  slider('master').value = String(state.master);
  updateReadouts();
}

function highlightPreset(name: PresetName | null): void {
  presetButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
}

function setLiveFilter(): void {
  if (!audio) return;
  const now = audio.ctx.currentTime;
  voices.forEach((v) => {
    v.filter.frequency.setTargetAtTime(state.cutoff, now, 0.02);
    v.filter.Q.setTargetAtTime(state.res, now, 0.02);
  });
}

function setLiveSpace(): void {
  if (audio) audio.wet.gain.setTargetAtTime(wetFromSpace(state.space), audio.ctx.currentTime, 0.03);
}

function applyPreset(name: PresetName): void {
  Object.assign(state, PRESETS[name]);
  syncControls();
  voices.forEach((v) => {
    v.osc.type = state.wave;
  });
  setLiveFilter();
  setLiveSpace();
  highlightPreset(name);
}

function wireSlider(id: string, read: (value: number) => void): void {
  slider(id).addEventListener('input', (e) => {
    read(Number((e.target as HTMLInputElement).value));
    highlightPreset(null);
    updateReadouts();
  });
}

function wireControls(): void {
  waveButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.wave = button.dataset.wave as Wave;
      waveButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      voices.forEach((v) => {
        v.osc.type = state.wave;
      });
      highlightPreset(null);
      updateReadouts();
    });
  });
  presetButtons.forEach((button) => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset as PresetName));
  });

  wireSlider('cutoff', (v) => {
    state.cutoff = posToHz(v);
    setLiveFilter();
  });
  wireSlider('resonance', (v) => {
    state.res = v;
    setLiveFilter();
  });
  wireSlider('attack', (v) => (state.a = v));
  wireSlider('decay', (v) => (state.d = v));
  wireSlider('sustain', (v) => (state.s = v));
  wireSlider('release', (v) => (state.r = v));
  wireSlider('space', (v) => {
    state.space = v;
    setLiveSpace();
  });
  // volume isn't part of a patch, so moving it leaves the preset selected
  slider('master').addEventListener('input', (e) => {
    state.master = Number((e.target as HTMLInputElement).value);
    if (audio) audio.master.gain.setTargetAtTime(state.master, audio.ctx.currentTime, 0.02);
    updateReadouts();
  });

  $('oct-down').addEventListener('click', () => setOctave(state.octave - 1));
  $('oct-up').addEventListener('click', () => setOctave(state.octave + 1));
  $('sculpt').addEventListener('click', sculptPad);
  $('enable').addEventListener('click', ensureAudio);
}

function updateEnable(): void {
  const running = audio?.ctx.state === 'running';
  $('enable').hidden = running;
  $('chain-out').textContent = running ? 'Your speakers' : 'Your speakers (sound off)';
  if (running) startDraw();
}

/* ───────────────────────────── sculpt a pad ───────────────────────────── */

/** Automate a bright saw into a warm pad over about a second and a half. */
function sculptPad(): void {
  const graph = ensureAudio();
  if (sculpting) return;
  sculpting = true;
  const button = $<HTMLButtonElement>('sculpt');
  button.disabled = true;

  applyPreset('saw'); // start bright and buzzy so the change is audible

  const chord = [0, 4, 7, 12]; // C major, plus the octave
  chord.forEach(noteOn);

  const dur = 1.5;
  const t0 = graph.ctx.currentTime;
  const pad = PRESETS.pad;

  // sound: sweep every voice's filter down, open the reverb up
  for (const semi of chord) {
    const v = voices.get(semi);
    if (!v) continue;
    v.filter.frequency.cancelScheduledValues(t0);
    v.filter.frequency.setValueAtTime(9000, t0);
    v.filter.frequency.exponentialRampToValueAtTime(pad.cutoff, t0 + dur);
    v.filter.Q.setValueAtTime(2, t0);
    v.filter.Q.linearRampToValueAtTime(pad.res, t0 + dur);
  }
  graph.wet.gain.cancelScheduledValues(t0);
  graph.wet.gain.setValueAtTime(wetFromSpace(state.space), t0);
  graph.wet.gain.linearRampToValueAtTime(wetFromSpace(pad.space), t0 + dur);

  // sight: slide the knobs from saw to pad, so you see the same move
  tweenControls(dur * 1000);

  // let the (now long) release ring out, then settle firmly on the pad patch
  window.setTimeout(() => chord.forEach(noteOff), dur * 1000 + 220);
  window.setTimeout(() => {
    applyPreset('pad');
    sculpting = false;
    button.disabled = false;
  }, dur * 1000 + 280);
}

/** Animate the controls (not the audio) from the current patch to the pad. */
function tweenControls(ms: number): void {
  const { wave: _wave, ...to } = PRESETS.pad;
  if (reducedMotion.matches) {
    Object.assign(state, to);
    syncControls();
    return;
  }
  const keys = Object.keys(to) as (keyof typeof to)[];
  const from = Object.fromEntries(keys.map((k) => [k, state[k]])) as Record<keyof typeof to, number>;
  const t0 = performance.now();
  const step = (now: number) => {
    const k = clamp((now - t0) / ms, 0, 1);
    const eased = k * k * (3 - 2 * k); // smoothstep
    for (const key of keys) state[key] = from[key] + (to[key] - from[key]) * eased;
    syncControls(); // moves the sliders, readouts and chain, but does not touch the voices
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ───────────────────────────── visualisers ───────────────────────────── */

interface Surface {
  g: CanvasRenderingContext2D;
  w: number;
  h: number;
}

const scopeCanvas = $<HTMLCanvasElement>('scope');
const specCanvas = $<HTMLCanvasElement>('spectrum');
let scope: Surface;
let spec: Surface;
let rafId: number | null = null;
let lastFrame = 0;
let quietFrames = 0;

const ACCENT = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c07cff';
const accentAlpha = (a: number): string => `color-mix(in srgb, ${ACCENT} ${Math.round(a * 100)}%, transparent)`;
const GRID = 'rgba(255,255,255,0.05)';
const REDUCED_FRAME_MS = 100; // reduced motion: a slow, glow-free trace instead of a 60 fps one

function setupCanvas(canvas: HTMLCanvasElement): Surface {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

function resizeCanvases(): void {
  scope = setupCanvas(scopeCanvas);
  spec = setupCanvas(specCanvas);
  drawIdle();
}

function drawGrid({ g, w, h }: Surface): void {
  g.strokeStyle = GRID;
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 1; i < 4; i++) {
    g.moveTo(0, (h / 4) * i);
    g.lineTo(w, (h / 4) * i);
  }
  for (let i = 1; i < 8; i++) {
    g.moveTo((w / 8) * i, 0);
    g.lineTo((w / 8) * i, h);
  }
  g.stroke();
}

function drawIdle(): void {
  const { g, w, h } = scope;
  g.clearRect(0, 0, w, h);
  drawGrid(scope);
  g.strokeStyle = accentAlpha(0.35);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, h / 2);
  g.lineTo(w, h / 2);
  g.stroke();
  spec.g.clearRect(0, 0, spec.w, spec.h);
  drawGrid(spec);
}

function drawScope(graph: Graph): void {
  const { g, w, h } = scope;
  const data = graph.timeData;
  g.clearRect(0, 0, w, h);
  drawGrid(scope);
  g.lineWidth = 2;
  g.strokeStyle = ACCENT;
  g.shadowColor = ACCENT;
  g.shadowBlur = reducedMotion.matches ? 0 : 6;
  g.beginPath();
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128; // -1 to 1
    const x = (i / (data.length - 1)) * w;
    const y = h / 2 - v * (h / 2) * 0.92;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.shadowBlur = 0;
}

function drawSpectrum(graph: Graph): void {
  const { g, w, h } = spec;
  const bins = graph.freqData;
  const binHz = graph.ctx.sampleRate / graph.analyser.fftSize;
  const maxBin = Math.min(bins.length, Math.ceil(14000 / binHz)); // show up to about 14 kHz
  const BARS = 64;
  const barWidth = w / BARS;

  g.clearRect(0, 0, w, h);
  drawGrid(spec);

  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, ACCENT);
  grad.addColorStop(1, accentAlpha(0.32));
  g.fillStyle = grad;
  for (let b = 0; b < BARS; b++) {
    const start = Math.floor((b / BARS) * maxBin);
    const end = Math.max(start + 1, Math.floor(((b + 1) / BARS) * maxBin));
    let peak = 0;
    for (let i = start; i < end; i++) if (bins[i] > peak) peak = bins[i];
    const barHeight = (peak / 255) * h;
    g.fillRect(b * barWidth, h - barHeight, Math.max(1, barWidth - 1), barHeight);
  }

  // a dashed marker where the lowpass cutoff sits on the axis
  const cutoffX = clamp((state.cutoff / (maxBin * binHz)) * w, 0, w);
  g.strokeStyle = accentAlpha(0.8);
  g.lineWidth = 1.5;
  g.setLineDash([4, 4]);
  g.beginPath();
  g.moveTo(cutoffX, 0);
  g.lineTo(cutoffX, h);
  g.stroke();
  g.setLineDash([]);
}

function draw(now: number): void {
  rafId = requestAnimationFrame(draw);
  if (!audio) return;
  if (reducedMotion.matches && now - lastFrame < REDUCED_FRAME_MS) return;
  lastFrame = now;
  audio.analyser.getByteTimeDomainData(audio.timeData);
  audio.analyser.getByteFrequencyData(audio.freqData);
  drawScope(audio);
  drawSpectrum(audio);

  // nothing sounding and the reverb tail gone: rest the trace and stop using the battery
  const silent = voices.size === 0 && audio.timeData.every((v) => v === 128);
  quietFrames = silent ? quietFrames + 1 : 0;
  if (quietFrames > 90 || (reducedMotion.matches && quietFrames > 10)) {
    cancelAnimationFrame(rafId);
    rafId = null;
    quietFrames = 0;
    drawIdle();
  }
}

function startDraw(): void {
  quietFrames = 0;
  if (rafId === null) rafId = requestAnimationFrame(draw);
}

/* ───────────────────────────── boot ───────────────────────────── */

buildKeyboard();
wireControls();
setOctave(state.octave);
syncControls();
resizeCanvases();
phone.addEventListener('change', buildKeyboard);

let resizeTimer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(resizeCanvases, 150);
});

// any first interaction creates the audio context; a tap on an iPhone only counts as
// permission once the finger lifts, so keep offering to resume until the context runs
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, ensureAudio, { once: true, capture: true }));
['pointerup', 'touchend', 'click'].forEach((ev) => window.addEventListener(ev, resume, { capture: true }));
