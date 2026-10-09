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

// Deployed to GitHub Pages as a project site: https://moshejs.github.io/digital-instruments/
export default defineConfig({
  site: 'https://moshejs.github.io',
  base: '/digital-instruments',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
      serialize: (item) => ({ ...item, lastmod }),
    }),
  ],
});
