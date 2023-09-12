<script lang="ts">
  import { onMount } from 'svelte';
  import type { Event } from 'nostr-tools';

  import type { ArticleTab, Tab } from '$lib/types';
  import { parsePlainText } from '$lib/articleParser';
  import UserLabel from '$components/UserLabel.svelte';
  import { next } from '$lib/utils';

  export let tab: Tab;
  export let replaceSelf: (tab: Tab) => void;
  export let createChild: (tab: Tab) => void;
  let results: Event[] = [];
  let tried = false;

  onMount(() => {});

  function openArticle(result: Event, ev: MouseEvent) {
    let articleTab: ArticleTab = { id: next(), type: 'article', data: result.id };
    if (ev.button === 1) createChild(articleTab);
    else replaceSelf(articleTab);
  }
</script>

<div class="font-sans mx-auto p-6 lg:max-w-4xl lg:pt-6 lg:pb-28">
  <div class="prose">
    <h1 class="mb-0">{tab.data}</h1>
  </div>
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
    <div class="px-4 py-5 bg-white border border-gray-300 rounded-lg mt-2 min-h-[48px]">
      <p class="mb-2">No articles found in this relay.</p>
    </div>
  {:else}
    <div class="px-4 py-5 rounded-lg mt-2 min-h-[48px]">Loading...</div>
  {/if}
</div>
