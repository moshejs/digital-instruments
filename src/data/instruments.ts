import { SITE } from '../lib/site';

export interface Instrument {
  slug: 'steelpan' | 'theremin';
  catalogNo: string;
  name: string;
  /** The name printed on the instrument's own page. */
  displayName: string;
  tagline: string;
  description: string;
  keywords: string[];
  specs: [label: string, value: string][];
  cta: string;
}

export const INSTRUMENTS: Instrument[] = [
  {
    slug: 'steelpan',
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
  },
  {
    slug: 'theremin',
    catalogNo: 'No. 02',
    name: 'Theremin',
    displayName: 'Aetherwave',
    tagline: 'The instrument you play without touching — hover, or tilt your phone through the air.',
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
