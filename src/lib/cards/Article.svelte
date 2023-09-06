<script lang="ts">
  import { afterUpdate, onMount } from 'svelte';
  import {
    type NostrEvent,
    NoteCollection,
    RequestBuilder,
    type StoreSnapshot
  } from '@snort/system';

  import { system } from '$lib/nostr';
  import { formatDate, next } from '$lib/utils';
  import { parse } from '$lib/articleParser.js';
  import type { Tab } from '$lib/types';
  import { page } from '$app/stores';
  import UserLabel from '$components/UserLabel.svelte';

  export let eventId: string;
  export let tab: Tab;
  export let createChild: (tab: Tab) => void;
  export let replaceSelf: (tab: Tab) => void;
  let event: NostrEvent | null = null;
  let copied = false;

  function addClickListenerToWikilinks() {
    const elements = document.querySelectorAll('[id^="wikilink-v0-"]');
    elements.forEach((element) => {
      element.addEventListener('click', () => {
        let title = element.id.slice(12);
        createChild({ id: next(), type: 'articlefind', data: title });
      });
    });
  }

  function shareCopy() {
    navigator.clipboard.writeText(`https://${$page.url.hostname}/?d=${eventId}`);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 2500);
  }

  onMount(() => {
    const rb = new RequestBuilder('article:' + eventId);
    rb.withFilter().ids([eventId]);

    const q = system.Query(NoteCollection, rb);
    const release = q.feed.hook(handleUpdate);

    handleUpdate();

    function cancel() {
      release();
      q.cancel();
    }

    function handleUpdate() {
      const state = q.feed.snapshot as StoreSnapshot<ReturnType<NoteCollection['getSnapshotData']>>;
      if (state.data?.length) {
        event = state.data[0];
        cancel();
      }
    }

    return cancel;
  });

  afterUpdate(() => {
    addClickListenerToWikilinks();
  });
</script>

<div>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-missing-attribute -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <article class="prose font-sans mx-auto p-6 lg:max-w-4xl lg:pt-6 lg:pb-28">
    {#if event === null}
      Loading article {eventId}
    {:else}
      <h1 class="mb-0">
        {#if event?.tags.find((e) => e[0] == 'title')?.[0] && event?.tags.find((e) => e[0] == 'title')?.[1]}
          {event.tags.find((e) => e[0] == 'title')?.[1]}
        {:else}
          {event.tags.find((e) => e[0] == 'd')?.[1]}
        {/if}
      </h1>
      <span>
        by <UserLabel pubkey={event.pubkey} />
        {#if event.created_at}
          updated on {formatDate(event.created_at)}
        {/if}
        <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events a11y-missing-attribute -->
        &nbsp;• &nbsp;<a
          class="cursor-pointer"
          on:click={() => {
            replaceSelf({
              id: next(),
              type: 'editor',
              data: {
                title: event?.tags.find(([k]) => k === 'title')?.[1] || '',
                summary: event?.tags.find(([k]) => k === 'summary')?.[1],
                content: event?.content,
                previous: tab
              }
            });
          }}>Fork</a
        >
        &nbsp;• &nbsp;<a class="cursor-pointer" on:click={shareCopy}
          >{#if copied}Copied!{:else}Share{/if}</a
        >
      </span>

      <!-- Content -->
      {@html parse(event?.content)}
    {/if}
  </article>
</div>
