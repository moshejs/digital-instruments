// @ts-check
import { execSync } from 'node:child_process';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The last commit's date stands in for every page's lastmod: the site is built
// as a whole, so a page is never newer than the commit it was built from.
const lastmod = (() => {
  try {
    return execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim();
  } catch {
    return new Date().toISOString();
  }
})();

// Two deploy targets share this config. The defaults are the GitHub Pages project site,
// https://moshejs.github.io/digital-instruments/. Vercel (which sets VERCEL=1 in its builds) serves
// the site at the root of https://digital-instruments.quentin.software/. SITE_URL and BASE_PATH
// override either one.
const onVercel = Boolean(process.env.VERCEL);

export default defineConfig({
  site: process.env.SITE_URL || (onVercel ? 'https://digital-instruments.quentin.software' : 'https://moshejs.github.io'),
  base: process.env.BASE_PATH || (onVercel ? '/' : '/digital-instruments'),
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
      serialize: (item) => ({ ...item, lastmod }),
    }),
  ],
});
