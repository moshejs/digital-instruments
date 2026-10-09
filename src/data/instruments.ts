import { SITE, withBase } from '../lib/site';
import type { InstrumentSlug } from './availability';

export interface Instrument {
  slug: InstrumentSlug;
  catalogNo: string;
  name: string;
  /** Compact name for navigation and table chips. */
  short: string;
  /** The name printed on the instrument's own page. */
  displayName: string;
  tagline: string;
  description: string;
  keywords: string[];
  specs: [label: string, value: string][];
  cta: string;
  /** Signature colour, used for hover states and links in the catalogue. */
  accent: string;
}

export const INSTRUMENTS: Instrument[] = [
  {
    slug: 'steelpan',
    short: 'Steelpan',
    catalogNo: 'No. 01',
    name: 'Steelpan',
    displayName: 'Steelpan',
    tagline: 'A Caribbean tenor pan you strike with a click, a tap or your keyboard.',
    description:
      'Play a Caribbean steel drum in your browser. 25 hammered chrome note pads in the authentic circle-of-fifths layout, synthesized live with Web Audio, plus nine songs with a follow-the-lights play-along guide.',
    keywords: ['steelpan', 'steel drum', 'online steel drum', 'virtual instrument', 'tenor pan', 'Web Audio', 'learn songs', 'Trinidad and Tobago'],
    specs: [
      ['Origin', 'Trinidad & Tobago, 1930s'],
      ['Range', 'C4 – C6 · 25 pads'],
      ['Layout', 'Circle-of-fifths spiral'],
      ['Play with', 'Mouse · touch · keyboard'],
      ['Engine', 'Additive partials + strike noise'],
    ],
    cta: 'Play the steelpan',
    accent: '#f6b23c',
  },
  {
    slug: 'theremin',
    short: 'Theremin',
    catalogNo: 'No. 02',
    name: 'Theremin',
    displayName: 'Aetherwave',
    tagline: 'The instrument you play without touching. Hover, or tilt your phone through the air.',
    description:
      'Play a theremin in your browser: glide your cursor for pitch and volume, or tilt and shake your phone. Live oscilloscope, portamento, vibrato, timbre and reverb controls, and nine songs with a follow-the-target guide.',
    keywords: ['theremin', 'online theremin', 'virtual theremin', 'Web Audio', 'gyroscope instrument', 'oscilloscope', 'electronic music', 'Léon Theremin'],
    specs: [
      ['Origin', 'Léon Theremin, 1920'],
      ['Range', 'C3 – C6 · continuous'],
      ['Voice', 'Glide · vibrato · timbre'],
      ['Play with', 'Hover · touch · phone tilt'],
      ['Engine', 'Twin oscillators + LFO'],
    ],
    cta: 'Play the theremin',
    accent: '#5cf2d6',
  },
  {
    slug: 'kalimba',
    short: 'Kalimba',
    catalogNo: 'No. 03',
    name: 'Kalimba',
    displayName: 'Kalimba',
    tagline: 'A thumb piano of tuned steel tines on a warm wooden board. Tap the tines, or play with two thumbs.',
    description:
      'Play a 17-key kalimba (thumb piano) in your browser. Tap steel tines laid out like the real instrument, read kalimba number tabs, and learn songs with a follow-the-tines guide — synthesized live with Web Audio.',
    keywords: ['kalimba', 'thumb piano', 'mbira', 'online kalimba', 'virtual kalimba', 'kalimba tabs', 'Web Audio', 'learn songs'],
    specs: [
      ['Origin', 'Southern Africa · mbira family'],
      ['Range', 'C4 – E6 · 17 tines, C major'],
      ['Layout', 'Alternating from the centre'],
      ['Play with', 'Tap · two thumbs · number keys'],
      ['Engine', 'Clamped-tine modes 1 : 6.27 : 17.55'],
    ],
    cta: 'Play the kalimba',
    accent: '#ff8a4c',
  },
  {
    slug: 'glass-harp',
    short: 'Glass Harp',
    catalogNo: 'No. 04',
    name: 'Glass Harp',
    displayName: 'Glass Harp',
    tagline: 'Twenty-five tuned wine glasses that sing when you circle their rims. Faster circles sing louder.',
    description:
      'Play a glass harp in your browser: press and circle the rim of a tuned wine glass to make it sing, faster for louder, with multi-touch chords. 25 chromatic glasses, synthesized live with Web Audio, plus a follow-along song guide.',
    keywords: ['glass harp', 'glass armonica', 'singing wine glasses', 'musical glasses', 'Benjamin Franklin armonica', 'online instrument', 'Web Audio'],
    specs: [
      ['Origin', 'Musical glasses · Franklin, 1761'],
      ['Range', 'C4 – C6 · 25 glasses'],
      ['Layout', 'Two rows, like piano keys'],
      ['Play with', 'Circle the rim · multi-touch'],
      ['Engine', 'Friction-driven glass modes'],
    ],
    cta: 'Play the glass harp',
    accent: '#b8a6ff',
  },
  {
    slug: 'harp',
    short: 'Harp',
    catalogNo: 'No. 05',
    name: 'Lever Harp',
    displayName: 'Lever Harp',
    tagline: 'Fifteen strings to pluck or sweep across, with real sharping levers that flip themselves for each song.',
    description:
      'Play a lever harp in your browser: pluck strings or drag across them to strum glissandos, and flip sharping levers like a real Celtic harp. Physically modelled plucked strings, synthesized live, with a follow-along song guide.',
    keywords: ['harp', 'lever harp', 'celtic harp', 'online harp', 'virtual harp', 'glissando', 'Karplus-Strong', 'Web Audio'],
    specs: [
      ['Origin', 'Celtic lever harp'],
      ['Range', 'C4 – C6 · 15 strings, E♭ tuning'],
      ['Levers', 'Raise any string a semitone'],
      ['Play with', 'Pluck · drag to strum · keys'],
      ['Engine', 'Karplus–Strong plucked string'],
    ],
    cta: 'Play the harp',
    accent: '#f3cf86',
  },
];

export const instrumentBySlug = (slug: Instrument['slug']): Instrument =>
  INSTRUMENTS.find((i) => i.slug === slug)!;

/** "Aetherwave — Theremin", or just "Steelpan" when the two names match. */
export const fullName = (i: Instrument): string =>
  i.displayName === i.name ? i.name : `${i.displayName} — ${i.name}`;

/** schema.org description of an instrument page, for search engines. */
export function instrumentJsonLd(instrument: Instrument, url: string, image: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: fullName(instrument),
    url,
    image,
    description: instrument.description,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires JavaScript and the Web Audio API',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Person', name: SITE.author },
    isPartOf: { '@type': 'WebSite', name: SITE.name },
    keywords: instrument.keywords.join(', '),
  };
}

/** schema.org breadcrumb: catalogue → instrument. */
export function breadcrumbJsonLd(instrument: Instrument, url: string, site: URL): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE.name, item: new URL(withBase(), site).href },
      { '@type': 'ListItem', position: 2, name: instrument.name, item: url },
    ],
  };
}
