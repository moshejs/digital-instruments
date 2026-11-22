/**
 * A deliberately separate, strict Standard MIDI File reader for the tests. It
 * shares no code with src/lib/midi.ts: it walks the chunks, decodes delta
 * times itself, supports running status, and throws on anything malformed.
 */

export interface ParsedEvent {
  tick: number;
  type: 'noteOn' | 'noteOff' | 'controller' | 'program' | 'pitchBend' | 'meta' | 'other';
  channel?: number;
  data: number[];
  metaType?: number;
}

export interface ParsedMidi {
  format: number;
  tracks: ParsedEvent[][];
  division: number;
}

function readVlq(b: Uint8Array, pos: number): [number, number] {
  let value = 0;
  for (let i = 0; i < 4; i++) {
    const byte = b[pos++];
    if (byte === undefined) throw new Error('VLQ runs past the end');
    value = (value << 7) | (byte & 0x7f);
    if (!(byte & 0x80)) return [value, pos];
  }
  throw new Error('VLQ longer than 4 bytes');
}

const str = (b: Uint8Array, at: number) => String.fromCharCode(...b.slice(at, at + 4));
const be32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const be16 = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];

export function parseMidi(bytes: Uint8Array): ParsedMidi {
  if (str(bytes, 0) !== 'MThd') throw new Error('missing MThd');
  if (be32(bytes, 4) !== 6) throw new Error('header length is not 6');
  const format = be16(bytes, 8);
  const ntrks = be16(bytes, 10);
  const division = be16(bytes, 12);
  let pos = 14;
  const tracks: ParsedEvent[][] = [];
  for (let n = 0; n < ntrks; n++) {
    if (str(bytes, pos) !== 'MTrk') throw new Error(`missing MTrk ${n}`);
    const len = be32(bytes, pos + 4);
    const end = pos + 8 + len;
    if (end > bytes.length) throw new Error('track runs past the end of the file');
    pos += 8;
    const events: ParsedEvent[] = [];
    let tick = 0;
    let running = 0;
    let ended = false;
    while (pos < end) {
      if (ended) throw new Error('bytes after end-of-track');
      let delta: number;
      [delta, pos] = readVlq(bytes, pos);
      tick += delta;
      let status = bytes[pos];
      if (status & 0x80) pos++;
      else if (running) status = running;
      else throw new Error('data byte without status');
      if (status === 0xff) {
        const metaType = bytes[pos++];
        let mlen: number;
        [mlen, pos] = readVlq(bytes, pos);
        events.push({ tick, type: 'meta', metaType, data: [...bytes.slice(pos, pos + mlen)] });
        pos += mlen;
        if (metaType === 0x2f) ended = true;
        running = 0;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        let slen: number;
        [slen, pos] = readVlq(bytes, pos);
        pos += slen;
        events.push({ tick, type: 'other', data: [] });
        running = 0;
        continue;
      }
      running = status;
      const hi = status & 0xf0;
      const channel = status & 0x0f;
      const size = hi === 0xc0 || hi === 0xd0 ? 1 : 2;
      const data = [...bytes.slice(pos, pos + size)];
      if (data.some((d) => d > 0x7f)) throw new Error(`data byte above 127 at ${pos}`);
      pos += size;
      const type =
        hi === 0x90 ? (data[1] === 0 ? 'noteOff' : 'noteOn')
        : hi === 0x80 ? 'noteOff'
        : hi === 0xb0 ? 'controller'
        : hi === 0xc0 ? 'program'
        : hi === 0xe0 ? 'pitchBend'
        : 'other';
      events.push({ tick, type, channel, data });
    }
    if (pos !== end) throw new Error('track length does not match its contents');
    if (!ended) throw new Error('track has no end-of-track');
    tracks.push(events);
  }
  if (pos !== bytes.length) throw new Error('trailing bytes after the last track');
  return { format, tracks, division };
}
