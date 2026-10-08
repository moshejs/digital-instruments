/** Site-wide metadata and URL helpers. */

export const SITE = {
  name: "Moshe's Digital Instruments",
  shortName: 'Digital Instruments',
  author: 'Moshe Malka',
  repo: 'https://github.com/moshejs/digital-instruments',
  description:
    'Real instruments, synthesized live in your browser — a Caribbean steelpan and a theremin you play without touching. No samples, no installs, nine songs with a follow-along guide.',
  locale: 'en_US',
  themeColor: '#121110',
} as const;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefixes a site-relative path with the deploy base (e.g. "/digital-instruments"). */
export const withBase = (path = ''): string => `${BASE}/${path.replace(/^\//, '')}`;
