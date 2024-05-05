<script lang="ts">
  import { onMount } from 'svelte';
  import type { Event } from 'nostr-tools';

  import { cachingSub, getA, userPreferredRelays, wikiKind } from '$lib/nostr';
  import type { ArticleTab, Tab } from '$lib/types';
  import { parsePlainText } from '$lib/articleParser';
  import UserLabel from '$components/UserLabel.svelte';
  import { next, normalizeArticleName } from '$lib/utils';

  export let query: string;
  export let tab: Tab;
  export let replaceSelf: (tab: Tab) => void;
  export let createChild: (tab: Tab) => void;
  let results: Event[] = [];
  let tried = false;

  onMount(() => {
    setTimeout(() => {
      tried = true;
    }, 1500);
    return cachingSub(
      `directsearch-${query}`,
      $userPreferredRelays.read,
      { kinds: [wikiKind], '#d': [normalizeArticleName(query)], limit: 25 },
      (events) => {
        results = events;
      },
      getA
    );
  });

  function openArticle(result: Event, ev: MouseEvent) {
    let articleTab: ArticleTab = { id: next(), type: 'article', data: result.id };
    if (ev.button === 1) createChild(articleTab);
    else replaceSelf(articleTab);
  }
</script>

<div class="mt-2 font-bold text-4xl">"{query}"</div>
{#each results as result}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    on:mouseup|preventDefault={openArticle.bind(null, result)}
    class="cursor-pointer px-4 py-5 bg-white border border-gray-300 hover:bg-slate-50 rounded-lg mt-2 min-h-[48px]"
  >
    <h1>
      {result.tags.find(([t]) => t == 'title')?.[1] || result.tags.find(([t]) => t == 'd')?.[1]}
    </h1>
    <div class="text-xs flex justify-between">
      <span>
        by <UserLabel pubkey={result.pubkey} />
      </span>
    </div>
    <p class="text-xs">
      {#if result.tags.find((e) => e[0] == 'summary')?.[0] && result.tags.find((e) => e[0] == 'summary')?.[1]}
        {result.tags
          .find((e) => e[0] == 'summary')?.[1]
          .slice(
            0,
            192
          )}{#if String(result.tags.find((e) => e[0] == 'summary')?.[1])?.length > 192}...{/if}
      {:else}
        {result.content.length <= 192
          ? parsePlainText(result.content.slice(0, 189))
          : parsePlainText(result.content.slice(0, 189)) + '...'}
      {/if}
    </p>
  </div>
{/each}
{#if tried}
  <div class="px-4 py-5 bg-white border border-gray-300 rounded-lg mt-2">
    <p class="mb-2 mt-0">
      {results.length < 1 ? "Can't find this article" : "Didn't find what you are looking for?"}
    </p>
    <button
      on:click={() => {
        replaceSelf({ id: next(), type: 'editor', data: { title: query, previous: tab } });
      }}
      class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      Create this article!
    </button>
    <button
      on:click={() => createChild({ id: next(), type: 'settings' })}
      class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      Add more relays
    </button>
  </div>
{:else}
  <div class="px-4 py-5 rounded-lg mt-2">Loading...</div>
{/if}
