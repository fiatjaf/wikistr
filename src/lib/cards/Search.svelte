<script lang="ts">
  import {
    NoteCollection,
    RequestBuilder,
    EventKind,
    type TaggedNostrEvent,
    type StoreSnapshot
  } from '@snort/system';
  import { onMount } from 'svelte';

  import { system, wikiKind } from '$lib/nostr';
  import type { TabType } from '$lib/types';
  import { createChildEverywhere } from '$lib/state';
  import { parsePlainText } from '$lib/articleParser';
  import UserLabel from '$components/UserLabel.svelte';

  export let query: string;
  export let replaceSelf: (newType: TabType, newData: string) => void;
  export let createChild: (type: TabType, data: string) => void;
  let results: TaggedNostrEvent[] = [];
  let tried = false;

  onMount(() => {
    const rb = new RequestBuilder(`search:${query}`);
    rb.withFilter()
      .kinds([wikiKind as EventKind])
      .tag('d', [query, query.toLowerCase()])
      .limit(25);

    const q = system.Query(NoteCollection, rb);
    const release = q.feed.hook(() => {
      const state = q.feed.snapshot as StoreSnapshot<ReturnType<NoteCollection['getSnapshotData']>>;
      if (state.data) {
        results = state.data.concat();
      }
    });

    setTimeout(() => {
      if (results.length === 0) {
        tried = true;
      }
    }, 1000);

    return () => {
      release();
      q.cancel();
    };
  });
</script>

<div class="font-sans mx-auto p-6 lg:max-w-4xl lg:pt-6 lg:pb-28">
  <div class="prose">
    <h1 class="mb-0">{query}</h1>
    <p class="mt-0 mb-0">
      There are {#if tried}{results.length}{:else}...{/if} articles with the name "{query}"
    </p>
  </div>
  {#each results as result}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div
      on:click={() => {
        $createChildEverywhere
          ? createChild('article', result.id)
          : replaceSelf('article', result.id);
      }}
      class="cursor-pointer px-4 py-5 bg-white border border-gray-300 hover:bg-slate-50 rounded-lg mt-2 min-h-[48px]"
    >
      <h1>
        {result.tags.find((e) => e[0] == 'title')?.[0] &&
        result.tags.find((e) => e[0] == 'title')?.[1]
          ? result.tags.find((e) => e[0] == 'title')?.[1]
          : result.tags.find((e) => e[0] == 'd')?.[1]}
      </h1>
      <p class="text-xs">
        <!-- implement published at? -->
        <!-- {#if result.tags.find((e) => e[0] == "published_at")}
              on {formatDate(result.tags.find((e) => e[0] == "published_at")[1])}
              {/if} -->
        by <UserLabel pubkey={result.pubkey} />
      </p>
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
      <p class="mb-2">
        {results.length < 1 ? "Can't find this article" : "Didn't find what you are looking for?"}
      </p>
      <button
        on:click={() => {
          $createChildEverywhere
            ? createChild('editor', JSON.stringify({ startD: query }))
            : replaceSelf('editor', JSON.stringify({ startD: query }));
        }}
        class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Create this article!
      </button>
      <button
        on:click={() => createChild('settings', '')}
        class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Add more relays
      </button>
    </div>
  {:else}
    <div class="px-4 py-5 rounded-lg mt-2 min-h-[48px]">Loading...</div>
  {/if}
</div>
