<script lang="ts">
  import debounce from 'debounce';
  import { onDestroy, onMount } from 'svelte';
  import type { SubCloser } from '@nostr/tools/abstract-pool';
  import type { Event, NostrEvent } from '@nostr/tools/pure';

  import {
    wikiKind,
    account,
    wot,
    getBasicUserWikiRelays,
    userWikiRelays
  } from '$lib/nostr';
  import type { ArticleCard, Card } from '$lib/types';
  import { addUniqueTaggedReplaceable, getTagOr, next } from '$lib/utils';
  import { subscribeAllOutbox } from '$lib/outbox';
  import ArticleListItem from '$components/ArticleListItem.svelte';
  import RelayItem from '$components/RelayItem.svelte';
  import { DEFAULT_WIKI_RELAYS } from '$lib/defaults';
  import { pool } from '@nostr/gadgets/global';

  interface Props {
    createChild: (card: Card) => void;
  }

  let { createChild }: Props = $props();
  let seenCache: { [id: string]: string[] } = {};
  let results = $state<Event[]>([]);

  const feeds = [normalFeed, followsFeed];
  let current = $state(0);

  const update = debounce(() => {
    // sort by an average of newness and wotness
    results.sort((a, b) => {
      const wotA = $wot[a.pubkey] || 0;
      const wotB = $wot[b.pubkey] || 0;
      let wotAvg = (wotA + wotB) / 2 || 1;
      let tsAvg = (a.created_at + b.created_at) / 2;
      return wotB / wotAvg + b.created_at / tsAvg - (wotA / wotAvg + a.created_at / tsAvg);
    });
    results = results;
    seenCache = seenCache;
  }, 500);

  let close = () => {};

  onDestroy(() => {
    close();
  });

  function openArticle(result: Event) {
    createChild({
      id: next(),
      type: 'article',
      data: [getTagOr(result, 'd'), result.pubkey],
      actualEvent: result,
      relayHints: seenCache[result.id] || []
    } as ArticleCard);
  }

  function restart() {
    close();
    results = [];
    close = feeds[current]();
  }

  setTimeout(restart, 400);

  function normalFeed() {
    let sub: SubCloser | undefined;
    let cancel = account.subscribe(async (account) => {
      if (sub) sub.close();

      sub = pool.subscribeMany(
        account ? await getBasicUserWikiRelays(account.pubkey) : DEFAULT_WIKI_RELAYS,
        [
          {
            kinds: [wikiKind],
            limit: 15
          }
        ],
        {
          id: 'recent',
          onevent,
          receivedEvent
        }
      );
    });

    return () => {
      if (sub) sub.close();
      cancel();
    };
  }

  function followsFeed() {
    let exited = false;

    let subc: SubCloser;
    let wotsubclose = wot.subscribe((wot) => {
      if (exited) {
        return;
      }

      const eligibleKeys = Object.entries(wot)
        .filter(([_, v]) => v > 170)
        .map(([k]) => k);

      subc = subscribeAllOutbox(
        eligibleKeys,
        { kinds: [wikiKind], limit: 20 },
        { id: 'alloutbox', onevent, receivedEvent }
      );
    });

    return () => {
      exited = true;
      wotsubclose();
      subc?.close?.();
    };
  }

  function onevent(evt: NostrEvent) {
    if (addUniqueTaggedReplaceable(results, evt)) update();
  }

  function receivedEvent(relay: any, id: string) {
    if (!(id in seenCache)) seenCache[id] = [];
    if (seenCache[id].indexOf(relay.url) === -1) seenCache[id].push(relay.url);
  }
</script>

<div class="flex items-center justify-between mb-4">
  <div class="font-bold text-4xl">
    {#if feeds[current] === normalFeed}
      Recent Articles
    {:else if feeds[current] === followsFeed}
      Articles from Contacts
    {/if}
  </div>
  {#if $account}
    <button
      onclick={() => {
        current = (current + 1) % feeds.length;
        restart();
      }}
      type="button"
      class="inline-flex items-center space-x-2 px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-white"
    >
      {#if feeds[current] === normalFeed}
        Show Contacts
      {:else if feeds[current] === followsFeed}
        Show Relays
      {/if}
    </button>
  {/if}
</div>

{#if feeds[current] === normalFeed}
  <div class="flex items-center flex-wrap gap-1 mb-6 text-sm text-stone-500">
    <span class="mr-1">from</span>
    {#each $userWikiRelays as url}
      <RelayItem {url} {createChild} />
    {/each}
  </div>
{/if}

<div class="space-y-4">
  {#each results as result (result.id)}
    <ArticleListItem event={result} {openArticle} />
  {/each}
</div>
