/**
 * The Record a take card: Record / Stop / Play back / Download .mid / Clear.
 * The instrument's script calls the returned recorder's noteOn / noteOff (and,
 * for the theremin, bend / expression) from its own note events; playback goes
 * back through the instrument's sound, never through the coach's scoring.
 * No network, no storage: the take is held in memory only.
 */
import { encodeMidi } from '../../lib/midi';
import { TAKE_LIMITS, TakeRecorder, type Take, type TakeEvent } from '../../lib/take';

export interface RecorderHost {
  /** Used for the file name, e.g. "steelpan". */
  slug: string;
  /** The MIDI track name. */
  name: string;
  /** General MIDI program, only when there is an obvious match. */
  program?: number;
  /** Pitch-bend range in semitones, for instruments that record bends. */
  bendRange?: number;
  /** Starts audio (and anything else the instrument needs) before playback; called from the click. */
  prepare(): void;
  /** Sounds one recorded event through the instrument. */
  play(event: TakeEvent): void;
  /** Silences whatever playback is still sounding. */
  silence(): void;
}

type State = 'empty' | 'recording' | 'ready' | 'playing';

const fmt = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const plural = (n: number, word: string) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

export function mountRecorder(host: RecorderHost): TakeRecorder {
  const card = document.getElementById('recorder');
  // a page without the card still gets a recorder that never records
  if (!card) return new TakeRecorder(() => performance.now());

  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const btnRecord = get<HTMLButtonElement>('recRecord');
  const btnStop = get<HTMLButtonElement>('recStop');
  const btnPlay = get<HTMLButtonElement>('recPlay');
  const btnDownload = get<HTMLButtonElement>('recDownload');
  const btnClear = get<HTMLButtonElement>('recClear');
  const time = get('recTime');
  const status = get('recStatus');

  let state: State = 'empty';
  let take: Take | null = null;
  let clockTimer = 0;
  let playTimers: number[] = [];
  let playStart = 0;

  const announce = (text: string) => {
    status.textContent = text;
  };

  const recorder = new TakeRecorder(
    () => performance.now(),
    TAKE_LIMITS,
    (reason) => {
      // a limit ended the take: keep what was recorded and say why
      finishRecording(
        reason === 'duration'
          ? 'Recording stopped: a take can be up to 5 minutes long.'
          : `Recording stopped: a take can hold up to ${TAKE_LIMITS.maxEvents.toLocaleString('en-US')} events.`,
      );
    },
  );

  function setState(next: State): void {
    state = next;
    card!.dataset.state = next;
    btnRecord.setAttribute('aria-pressed', String(next === 'recording'));
    btnPlay.setAttribute('aria-pressed', String(next === 'playing'));
    btnStop.disabled = next !== 'recording' && next !== 'playing';
    const hasTake = take !== null && take.noteCount > 0;
    btnPlay.disabled = !hasTake || next === 'recording';
    btnDownload.disabled = !hasTake || next === 'recording';
    btnClear.disabled = !hasTake || next === 'recording';
    // never strand keyboard focus on a button that just became disabled
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && active.disabled && card!.contains(active)) {
      (next === 'ready' ? btnPlay : btnRecord).focus();
    }
  }

  function startRecording(): void {
    stopPlayback();
    const replacing = take !== null && take.noteCount > 0;
    take = null;
    recorder.start();
    time.textContent = '0:00';
    window.clearInterval(clockTimer);
    clockTimer = window.setInterval(() => {
      recorder.tick();
      if (recorder.recording) time.textContent = fmt(recorder.elapsed());
    }, 250);
    setState('recording');
    announce(replacing ? 'Recording a new take; the last one is replaced. Play now.' : 'Recording. Play now.');
  }

  function finishRecording(limitMessage?: string): void {
    window.clearInterval(clockTimer);
    take = recorder.stop();
    if (take.noteCount === 0) {
      take = null;
      time.textContent = '0:00';
      setState('empty');
      announce(limitMessage ?? 'Stopped. Nothing was played, so there is nothing to keep.');
      return;
    }
    time.textContent = fmt(take.durationMs);
    setState('ready');
    const summary = `${plural(take.noteCount, 'note')}, ${fmt(take.durationMs)}.`;
    announce(limitMessage ? `${limitMessage} Kept ${summary}` : `Stopped. Recorded ${summary}`);
  }

  function startPlayback(): void {
    if (!take) return;
    host.prepare();
    stopPlayback();
    playStart = performance.now();
    playTimers = take.events.map((e) => window.setTimeout(() => host.play(e), e.t));
    playTimers.push(window.setTimeout(() => {
      host.silence();
      playTimers = [];
      window.clearInterval(clockTimer);
      if (take) time.textContent = fmt(take.durationMs);
      setState('ready');
      announce('Playback finished.');
    }, take.durationMs + 120));
    window.clearInterval(clockTimer);
    clockTimer = window.setInterval(() => {
      time.textContent = fmt(Math.min(performance.now() - playStart, take?.durationMs ?? 0));
    }, 250);
    time.textContent = '0:00';
    setState('playing');
    announce('Playing back your take.');
  }

  function stopPlayback(): void {
    if (state !== 'playing') return;
    playTimers.forEach((id) => window.clearTimeout(id));
    playTimers = [];
    window.clearInterval(clockTimer);
    host.silence();
    if (take) time.textContent = fmt(take.durationMs);
    setState(take ? 'ready' : 'empty');
  }

  function download(): void {
    if (!take) return;
    const bytes = encodeMidi({ name: host.name, events: take.events, program: host.program, bendRange: host.bendRange });
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${host.slug}-take-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.mid`;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    announce(`Saved ${a.download}.`);
  }

  btnRecord.addEventListener('click', () => (state === 'recording' ? finishRecording() : startRecording()));
  btnStop.addEventListener('click', () => {
    if (state === 'recording') finishRecording();
    else if (state === 'playing') {
      stopPlayback();
      announce('Playback stopped.');
    }
  });
  btnPlay.addEventListener('click', () => (state === 'playing' ? (stopPlayback(), announce('Playback stopped.')) : startPlayback()));
  btnDownload.addEventListener('click', download);
  btnClear.addEventListener('click', () => {
    stopPlayback();
    take = null;
    time.textContent = '0:00';
    setState('empty');
    announce('Take cleared.');
  });

  const iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  get('recIos').hidden = !iOS;

  setState('empty');
  return recorder;
}
