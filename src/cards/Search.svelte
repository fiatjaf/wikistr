<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { debounce } from 'debounce';
  import type { NostrEvent, Event } from 'nostr-tools/pure';
  import type { AbstractRelay } from 'nostr-tools/abstract-relay';
  import type { SubCloser } from 'nostr-tools/abstract-pool';

  import { _pool, wot, wikiKind, userWikiRelays } from '$lib/nostr';
  import type { ArticleCard, SearchCard, Card } from '$lib/types';
  import {
    addUniqueTaggedReplaceable,
    getTagOr,
    next,
    normalizeIdentifier,
    unique
  } from '$lib/utils';
  import { DEFAULT_SEARCH_RELAYS } from '$lib/defaults';
  import ArticleListItem from '$components/ArticleListItem.svelte';
  import { loadRelayList } from '$lib/lists';
  import { replaceState } from '$app/navigation';
  import { page } from '$app/stores';
  import { cards } from '$lib/state';

  export let card: Card;
  export let replaceSelf: (card: Card) => void;
  export let createChild: (card: Card) => void;
  let tried = false;
  let eosed = 0;
  let editable = false;

  const searchCard = card as SearchCard;

  let query: string;
  let seenCache: { [id: string]: string[] } = {};
  let results: NostrEvent[] = [];

  // close handlers
  let uwrcancel: () => void;
  let search: SubCloser;
  let subs: SubCloser[] = [];

  onMount(() => {
    query = searchCard.data;
  });

  onMount(() => {
    // we won't do any searches if we already have the results
    if (searchCard.results) {
      seenCache = searchCard.seenCache || {};
      results = searchCard.results || [];

      tried = true;
      return;
    }

    performSearch();
  });

  onDestroy(destroy);

  function destroy() {
    if (uwrcancel) uwrcancel();
    subs.forEach((sub) => sub.close());
    if (search) search.close();
  }

  async function performSearch() {
    // cancel existing subscriptions and zero variables
    destroy();
    tried = false;
    eosed = 0;
    results = [];

    setTimeout(() => {
      tried = true;
    }, 1500);

    const update = debounce(() => {
      // sort by exact matches first, then by wotness
      let normalizedIdentifier = normalizeIdentifier(query);
      results = results.sort((a, b) => {
        if (
          getTagOr(a, 'd') === normalizedIdentifier &&
          getTagOr(b, 'd') !== normalizedIdentifier
        ) {
          return -1;
        } else if (
          getTagOr(b, 'd') === normalizedIdentifier &&
          getTagOr(a, 'd') !== normalizedIdentifier
        ) {
          return 1;
        } else {
          return ($wot[b.pubkey] || 0) - ($wot[a.pubkey] || 0);
        }
      });
      seenCache = seenCache;
    }, 500);

    const relaysFromPreferredAuthors = unique(
      (await Promise.all((searchCard.preferredAuthors || []).map(loadRelayList)))
        .flat()
        .filter((ri) => ri.write)
        .map((ri) => ri.url)
    );

    let previouslyQueriedRelays: string[] = [];
    uwrcancel = userWikiRelays.subscribe(async (uwr) => {
      const relaysToUseNow = [];

      for (let i = 0; i < uwr.length; i++) {
        let r = uwr[i];
        if (previouslyQueriedRelays.indexOf(r) === -1) {
          relaysToUseNow.push(r);
          previouslyQueriedRelays.push(r);
        }
      }

      for (let i = 0; i < relaysFromPreferredAuthors.length; i++) {
        let r = relaysFromPreferredAuthors[i];
        if (previouslyQueriedRelays.indexOf(r) === -1) {
          relaysToUseNow.push(r);
          previouslyQueriedRelays.push(r);
        }
      }

      if (relaysToUseNow.length === 0) return;

      let subc = _pool.subscribeMany(
        relaysToUseNow,
        [{ kinds: [wikiKind], '#d': [normalizeIdentifier(query)], limit: 25 }],
        {
          id: 'find-exactmatch',
          onevent(evt) {
            tried = true;

            if (searchCard.preferredAuthors.includes(evt.pubkey)) {
              // we found an exact match that fits the list of preferred authors
              // jump straight into it
              openArticle(evt, undefined, true);
            }

            if (addUniqueTaggedReplaceable(results, evt)) update();
          },
          oneose,
          receivedEvent
        }
      );

      subs.push(subc);
    });

    search = _pool.subscribeMany(
      DEFAULT_SEARCH_RELAYS,
      [{ kinds: [wikiKind], search: query, limit: 10 }],
      {
        id: 'find-search',
        onevent(evt) {
          if (addUniqueTaggedReplaceable(results, evt)) update();
        },
        oneose,
        receivedEvent
      }
    );

    function oneose() {
      eosed++;
      if (eosed === 2) {
        tried = true;
        searchCard.results = results;
        searchCard.seenCache = seenCache;
      }
    }

    function receivedEvent(relay: AbstractRelay, id: string) {
      if (!(id in seenCache)) seenCache[id] = [];
      if (seenCache[id].indexOf(relay.url) === -1) seenCache[id].push(relay.url);
    }
  }

  const debouncedPerformSearch = debounce(performSearch, 400);

  function openArticle(result: Event, ev?: MouseEvent, direct?: boolean) {
    let articleCard: ArticleCard = {
      id: next(),
      type: 'article',
      data: [getTagOr(result, 'd'), result.pubkey],
      relayHints: seenCache[result.id],
      actualEvent: result,
      versions:
        getTagOr(result, 'd') === normalizeIdentifier(query)
          ? results.filter((evt) => getTagOr(evt, 'd') === normalizeIdentifier(query))
          : undefined
    };
    if (ev?.button === 1) createChild(articleCard);
    else if (direct)
      // if this is called with 'direct' we won't give it a back button
      replaceSelf(articleCard);
    else replaceSelf({ ...articleCard, back: card }); // otherwise we will
  }

  function startEditing() {
    debouncedPerformSearch.clear();
    editable = true;
  }

  function preventKeys(ev: KeyboardEvent) {
    if (ev.key === 'Enter' || ev.key === 'Tab') {
      ev.preventDefault();
      (ev.currentTarget as any)?.blur();
      finishedEditing();
    }
  }

  function finishedEditing() {
    if (!editable) return;

    editable = false;
    query = query.replace(/[\r\n]/g, '').replace(/[^\w .:-]/g, '-');
    if (query !== searchCard.data) {
      // replace browser url and history
      let index = $cards.findIndex((t) => t.id === card.id);
      let replacementURL = $page.url.pathname.split('/').slice(1);
      replacementURL[index] = query;

      let currentState = $page.state as [number, Card];
      replaceState('/' + replacementURL.join('/'), currentState[0] === index ? [] : currentState);

      // update stored card state
      searchCard.data = normalizeIdentifier(query);
      searchCard.results = undefined;

      // redo the query
      debouncedPerformSearch();
    }
  }
</script>

<div class="mt-2 font-bold text-4xl">
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  "<span
    on:dblclick={startEditing}
    on:blur={finishedEditing}
    on:keydown={preventKeys}
    contenteditable="plaintext-only"
    bind:textContent={query}
  />"
</div>
{#each results as result (result.id)}
  <ArticleListItem event={result} {openArticle} />
{/each}
{#if tried}
  <div class="px-4 py-4 bg-white border-2 border-stone rounded-lg mt-4">
    <p class="mb-2 mt-0">
      {results.length < 1 ? "Can't find this article." : "Didn't find what you were looking for?"}
    </p>
    <button
      on:click={() => {
        replaceSelf({ id: next(), type: 'editor', data: { title: query, previous: card } });
      }}
      class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      Create this article!
    </button>
    <button
      on:click={() => createChild({ id: next(), type: 'settings' })}
      class="ml-1 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      Add more relays
    </button>
  </div>
{:else}
  <div class="px-4 py-5 rounded-lg mt-2">Loading...</div>
{/if}
