<script lang="ts">
  import { afterUpdate, onMount } from 'svelte';
  import { type NostrEvent, NoteCollection, RequestBuilder } from '@snort/system';

  import { system } from '$lib/nostr';
  import { formatDate } from '$lib/utils';
  import { parse } from '$lib/articleParser.js';
  import type { TabType } from '$lib/types';
  import { page } from '$app/stores';
  import { createChildEverywhere } from '$lib/state';
  import UserLabel from '$components/UserLabel.svelte';

  export let eventid: string;
  export let createChild: (type: TabType, data: string) => void;
  export let replaceSelf: (newType: TabType, newData: string) => void;
  let event: NostrEvent | null = null;
  let copied = false;

  function addClickListenerToWikilinks() {
    const elements = document.querySelectorAll('[id^="wikilink-v0-"]');
    elements.forEach((element) => {
      element.addEventListener('click', () => {
        //alert(`Clicked element with ID: ${element.id}`);
        let a = element.id.slice(12);
        createChild('articlefind', a);
      });
    });
  }

  function shareCopy() {
    navigator.clipboard.writeText(`https://${$page.url.hostname}/?d=${eventid}`);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 2500);
  }

  onMount(() => {
    const rb = new RequestBuilder('specific-article');
    rb.withFilter().ids([eventid]);

    const q = system.Query(NoteCollection, rb);
    q.onEvent = (_, evt) => {
      event = evt;
      q.cancel();
    };

    return () => q.cancel();
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
    {#if event !== null}
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
            let data = JSON.stringify({
              startTitle:
                event?.tags.find((e) => e[0] == 'title')?.[0] &&
                event?.tags.find((e) => e[0] == 'title')?.[1]
                  ? event.tags.find((e) => e[0] == 'title')?.[1]
                  : event?.tags.find((e) => e[0] == 'd')?.[1],
              startSummary:
                event?.tags.find((e) => e[0] == 'summary')?.[0] &&
                event?.tags.find((e) => e[0] == 'summary')?.[1]
                  ? event?.tags.find((e) => e[0] == 'summary')?.[1]
                  : undefined,
              startContent: event?.content
            });
            $createChildEverywhere ? createChild('editor', data) : replaceSelf('editor', data);
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
