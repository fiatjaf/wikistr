<script lang="ts">
  import type { SearchCard, Card } from '$lib/types';
  import { next } from '$lib/utils';
  import { getExtra } from 'svelte-asciidoc';

  export let attrs: { [_: string]: string };

  const { href } = attrs;
  const wikitarget = href.substring(9); // Remove 'wikilink:' prefix

  const extra: undefined | { preferredAuthors: string[]; createChild: (card: Card) => void } =
    getExtra();
  const { preferredAuthors, createChild } = extra || {
    preferredAuthors: [],
    createChild: undefined
  };

  function handleWikilinkClick() {
    if (createChild) {
      // Decode HTML entities: preserve double dashes and remove zero-width spaces
      const decoded = wikitarget.replace(/&[#\w]+;/g, (match) => {
        // Preserve double dashes
        if (match === '&#8212;') {
          return '--';
        }

        // Remove zero-width spaces
        if (match === '&#8203;') {
          return '';
        }

        return match;
      });

      createChild({ id: next(), type: 'find', data: decoded, preferredAuthors } as SearchCard);
    }
  }
</script>

<button
  class="text-indigo-600 underline"
  title={`wikilink to: "${wikitarget}"`}
  on:click={handleWikilinkClick}><slot /></button
>
