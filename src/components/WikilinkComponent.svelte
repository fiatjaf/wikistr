<script lang="ts">
  import type { SearchCard, Card } from '$lib/types';
  import { next } from '$lib/utils';
  import { getExtra } from 'svelte-asciidoc';

  export let attrs: { [_: string]: string };

  const { href } = attrs;

  const extra: undefined | { preferredAuthors: string[]; createChild: (card: Card) => void } =
    getExtra();
  const { preferredAuthors, createChild } = extra || {
    preferredAuthors: [],
    createChild: undefined
  };

  let wikitarget: string;
  if (href.startsWith('wikilink:')) {
    wikitarget = href.substring(9);
  }

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

{#if href.startsWith('wikilink')}
  <button
    class="text-indigo-600 underline"
    title={`wikilink to: "${wikitarget}"`}
    on:click={handleWikilinkClick}><slot /></button
  >
{:else}
  <!-- svelte-ignore a11y-missing-attribute -->
  <a target="_blank" {...attrs}>
    <slot />
    <svg
      class="align-text-top h-3.5 inline pl-1"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      ><g stroke-linecap="round" stroke-linejoin="round"></g><g>
        <g>
          <path
            d="M10.0002 5H8.2002C7.08009 5 6.51962 5 6.0918 5.21799C5.71547 5.40973 5.40973 5.71547 5.21799 6.0918C5 6.51962 5 7.08009 5 8.2002V15.8002C5 16.9203 5 17.4801 5.21799 17.9079C5.40973 18.2842 5.71547 18.5905 6.0918 18.7822C6.5192 19 7.07899 19 8.19691 19H15.8031C16.921 19 17.48 19 17.9074 18.7822C18.2837 18.5905 18.5905 18.2839 18.7822 17.9076C19 17.4802 19 16.921 19 15.8031V14M20 9V4M20 4H15M20 4L13 11"
            stroke="#000000"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></path>
        </g>
      </g></svg
    >
  </a>
{/if}
