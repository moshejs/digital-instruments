// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Deployed to GitHub Pages as a project site: https://moshejs.github.io/digital-instruments/
export default defineConfig({
  site: 'https://moshejs.github.io',
  base: '/digital-instruments',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
  ],
});
