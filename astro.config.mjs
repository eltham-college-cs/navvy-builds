import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://eltham-college-cs.github.io',
  base: '/navvy-builds/',
  trailingSlash: 'always',
  output: 'static',
});
