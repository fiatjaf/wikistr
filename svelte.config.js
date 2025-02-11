import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [vitePreprocess({})],

  kit: {
    adapter: adapter({
      fallback: 'index.html'
    }),
    alias: {
      $lib: 'src/lib',
      $components: 'src/components',
      $cards: 'src/cards'
    }
  }
};

export default config;
