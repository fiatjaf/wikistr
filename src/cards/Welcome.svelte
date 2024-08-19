<script lang="ts">
  import { debounce } from 'debounce';
  import { onDestroy } from 'svelte';
  import type { SubCloser } from 'nostr-tools/abstract-pool';
  import type { AbstractRelay } from 'nostr-tools/abstract-relay';
  import type { Event, NostrEvent } from 'nostr-tools/pure';

  import {
    signer,
    wikiKind,
    account,
    _pool,
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

  export let createChild: (card: Card) => void;
  let seenCache: { [id: string]: string[] } = {};

  let results: Event[] = [];
  const feeds = [normalFeed, followsFeed];
  let current = 0;

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

  function doLogin() {
    signer.getPublicKey();
  }

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

      sub = _pool.subscribeMany(
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

  function receivedEvent(relay: AbstractRelay, id: string) {
    if (!(id in seenCache)) seenCache[id] = [];
    if (seenCache[id].indexOf(relay.url) === -1) seenCache[id].push(relay.url);
  }
</script>

<div class="font-bold text-4xl">Account</div>
<div class="mb-4 mt-2">
  {#if $account}
    <div class="flex h-12">
      {#if $account.image}
        <img class="full-h" src={$account.image} alt="user avatar" />
      {/if}
      <div class="ml-2">
        <p class="w-64 text-ellipsis overflow-hidden">{$account.npub}</p>
        <p>{$account.shortName}</p>
      </div>
    </div>
    <div class="mt-2">
      <button
        on:click={() => {
          current = (current + 1) % feeds.length;
          restart();
        }}
        type="submit"
        class="inline-flex items-center space-x-2 px-3 py-2 border border-gray-300 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-white"
      >
        {#if feeds[current] === normalFeed}
          Browse articles from contacts
        {:else if feeds[current] === followsFeed}
          Browse articles from your relays
        {/if}
      </button>
    </div>
  {:else}
    <button
      on:click={doLogin}
      type="submit"
      class="inline-flex items-center space-x-2 px-3 py-2 border border-gray-300 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-white"
      >Login</button
    >
  {/if}
</div>

<div class="mb-2 font-bold text-4xl">
  {#if feeds[current] === normalFeed}
    Recent Articles
    <div class="flex items-center flex-wrap">
      <div class="mr-1 font-normal text-xs">from</div>
      {#each $userWikiRelays as url}
        <RelayItem {url} {createChild} />
      {/each}
    </div>
  {:else if feeds[current] === followsFeed}
    Articles from Contacts
  {/if}
</div>
{#each results as result (result.id)}
  <ArticleListItem event={result} {openArticle} />
{/each}
