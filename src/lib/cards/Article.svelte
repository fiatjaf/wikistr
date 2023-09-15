<script lang="ts">
  import { afterUpdate, onMount } from 'svelte';
  import type { Event } from 'nostr-tools';

  import { cachingSub, cachedArticles, userPreferredRelays, getRelaysForEvent } from '$lib/nostr';
  import { formatDate, next } from '$lib/utils';
  import { parse } from '$lib/articleParser.js';
  import type { RelayTab, SearchTab, Tab } from '$lib/types';
  import { page } from '$app/stores';
  import UserLabel from '$components/UserLabel.svelte';

  export let eventId: string;
  export let tab: Tab;
  export let createChild: (tab: Tab) => void;
  export let replaceSelf: (tab: Tab) => void;
  let event: Event | null = null;
  let copied = false;

  $: title = event?.tags.find(([k]) => k === 'title')?.[1] || '';
  $: summary = event?.tags.find(([k]) => k === 'summary')?.[1];

  function addClickListenerToWikilinks() {
    const elements = document.querySelectorAll('[id^="wikilink-v0-"]');
    elements.forEach((element) => {
      element.addEventListener('click', () => {
        let title = element.id.slice(12);
        createChild({ id: next(), type: 'find', data: title });
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
      type: 'find',
      data: event?.tags.find(([k]) => k === 'd')?.[1] || ''
    };
    if (ev.button === 1) createChild(nextTab);
    else replaceSelf(nextTab);
  }

  function openRelay(relay: string) {
    let relayTab: RelayTab = { id: next(), type: 'relay', data: relay };
    createChild(relayTab);
  }

  onMount(() => {
    let cached = cachedArticles.get(eventId);
    if (cached) {
      event = cached;
      return;
    }

    return cachingSub(
      `article-${eventId.slice(-8)}`,
      $userPreferredRelays,
      { ids: [eventId] },
      (result) => {
        event = result[0];
      }
    );
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
        <a class="cursor-pointer" on:mouseup|preventDefault={seeOthers}>Versions</a>
      </span>

      <!-- Content -->
      {@html parse(event?.content)}

      <div class="mt-4">
        <h2 class="m-0 p-0">Found on relays</h2>
        <ul class="list-disc m-0 pt-2 px-5">
          {#each getRelaysForEvent(event) as r}
            <li class="p-0 m-0 cursor-pointer">
              <a on:mouseup|preventDefault={openRelay.bind(null, r)}>
                {new URL(r).host}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </article>
</div>
