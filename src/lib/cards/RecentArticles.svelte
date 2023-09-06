<script lang="ts">
  import { parsePlainText } from '$lib/articleParser';
  import { onMount } from 'svelte';
  import {
    type TaggedNostrEvent,
    type StoreSnapshot,
    NoteCollection,
    RequestBuilder,
    EventKind
  } from '@snort/system';

  import { system, wikiKind } from '$lib/nostr';
  import type { Tab } from '$lib/types';
  import UserLabel from '$components/UserLabel.svelte';
  import { next } from '$lib/utils';

  let results: TaggedNostrEvent[] = [];
  export let createChild: (tab: Tab) => void;

  onMount(() => {
    const rb = new RequestBuilder('recent');
    rb.withFilter()
      .kinds([wikiKind as EventKind])
      .limit(12);

    const q = system.Query(NoteCollection, rb);
    const release = q.feed.hook(handleUpdate);
    handleUpdate();

    function handleUpdate() {
      const state = q.feed.snapshot as StoreSnapshot<ReturnType<NoteCollection['getSnapshotData']>>;
      if (state.data) {
        results = state.data.concat();
      }
    }

    return () => {
      release();
      q.cancel();
    };
  });
</script>

<div class="font-sans mx-auto p-6 lg:max-w-4xl lg:pt-6 lg:pb-28">
  <div class="prose">
    <h1 class="mt-0">Recent Articles</h1>
  </div>
  {#each results as result}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div
      on:click={() =>
        createChild({
          type: 'article',
          id: next(),
          data: result.id
        })}
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
</div>
