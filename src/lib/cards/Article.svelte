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
  import type { SearchTab, Tab } from '$lib/types';
  import { page } from '$app/stores';
  import UserLabel from '$components/UserLabel.svelte';
  import { track } from '$lib/labels';

  export let eventId: string;
  export let tab: Tab;
  export let createChild: (tab: Tab) => void;
  export let replaceSelf: (tab: Tab) => void;
  let event: NostrEvent | null = null;
  let copied = false;

  $: title = event?.tags.find(([k]) => k === 'title')?.[1] || '';
  $: summary = event?.tags.find(([k]) => k === 'summary')?.[1];

  function addClickListenerToWikilinks() {
    const elements = document.querySelectorAll('[id^="wikilink-v0-"]');
    elements.forEach((element) => {
      element.addEventListener('click', () => {
        let title = element.id.slice(12);
        createChild({ id: next(), type: 'articlefind', data: title });
      });
    });
  }

  function edit() {
    replaceSelf({
      id: next(),
      type: 'editor',
      data: {
        title,
        summary,
        content: event?.content,
        previous: tab
      }
    });
  }

  function shareCopy() {
    navigator.clipboard.writeText(`https://${$page.url.hostname}/${title}/${eventId}`);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 2500);
  }

  function seeOthers(ev: MouseEvent) {
    let nextTab: SearchTab = {
      id: next(),
      type: 'articlefind',
      data: event?.tags.find(([k]) => k === 'd')?.[1] || ''
    };
    if (ev.button === 1) createChild(nextTab);
    else replaceSelf(nextTab);
  }

  onMount(() => {
    const rb = new RequestBuilder('article:' + eventId);
    rb.withFilter().ids([eventId]);

    const q = system.Query(NoteCollection, rb);
    const release = q.feed.hook(handleUpdate);
    handleUpdate();
    return cancel;

    function handleUpdate() {
      const state = q.feed.snapshot as StoreSnapshot<ReturnType<NoteCollection['getSnapshotData']>>;
      if (state.data?.length) {
        event = state.data[0];
        track(event);
        cancel();
      }
    }

    function cancel() {
      release();
      q.cancel();
    }
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
          on {formatDate(event.created_at)}
        {/if}
        <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events a11y-missing-attribute -->
        <br /><a class="cursor-pointer" on:click={edit}>Fork</a>
        &nbsp;• &nbsp;
        <a class="cursor-pointer" on:click={shareCopy}
          >{#if copied}Copied!{:else}Share{/if}</a
        >
        &nbsp;• &nbsp;
        <a class="cursor-pointer" on:mouseup|preventDefault={seeOthers}>Others</a>
      </span>

      <!-- Content -->
      {@html parse(event?.content)}
    {/if}
  </article>
</div>
