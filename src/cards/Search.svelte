<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { debounce } from 'debounce';
  import type { Event, SubCloser } from 'nostr-tools';

  import { _pool, wot, wikiKind, userWikiRelays } from '$lib/nostr';
  import type { ArticleTab, SearchTab, Tab } from '$lib/types';
  import {
    addUniqueTaggedReplaceable,
    getTagOr,
    next,
    normalizeArticleName,
    unique
  } from '$lib/utils';
  import { DEFAULT_SEARCH_RELAYS } from '$lib/defaults';
  import ArticleListItem from '$components/ArticleListItem.svelte';
  import { loadRelayList } from '$lib/lists';
  import { replaceState } from '$app/navigation';
  import { page } from '$app/stores';
  import { tabs } from '$lib/state';

  export let tab: Tab;
  export let replaceSelf: (tab: Tab) => void;
  export let createChild: (tab: Tab) => void;
  let seenCache: { [id: string]: string[] } = {};
  let results: Event[] = [];
  let tried = false;

  const searchTab = tab as SearchTab;

  let editable = false;
  let query = searchTab.data;

  // close handlers
  let search: SubCloser;
  let sub: SubCloser;
  onMount(performSearch);
  onDestroy(() => {
    if (sub) sub.close();
    if (search) search.close();
  });

  async function performSearch() {
    tried = false;
    results = [];

    setTimeout(() => {
      tried = true;
    }, 1500);

    const update = debounce(() => {
      // sort by exact matches first, then by wotness
      results = results.sort((a, b) => {
        if (getTagOr(a, 'd') === query && getTagOr(b, 'd') !== query) {
          return -1;
        } else if (getTagOr(b, 'd') === query && getTagOr(a, 'd') !== query) {
          return 1;
        } else {
          return ($wot[b.pubkey] || 0) - ($wot[a.pubkey] || 0);
        }
      });
      seenCache = seenCache;
    }, 500);

    const relaysFromPreferredAuthors = unique(
      (await Promise.all((searchTab.preferredAuthors || []).map(loadRelayList)))
        .flat()
        .filter((ri) => ri.write)
        .map((ri) => ri.url)
    );

    sub = _pool.subscribeMany(
      $userWikiRelays.concat(relaysFromPreferredAuthors),
      [{ kinds: [wikiKind], '#d': [normalizeArticleName(query)], limit: 25 }],
      {
        id: 'find-exactmatch',
        oneose() {
          tried = true;
        },
        onevent(evt) {
          tried = true;

          if (searchTab.preferredAuthors.includes(evt.pubkey)) {
            // we found an exact match that fits the list of preferred authors
            // jump straight into it
            openArticle(evt, undefined, true);
          }

          if (addUniqueTaggedReplaceable(results, evt)) update();
        },
        receivedEvent(relay, id) {
          if (!(id in seenCache)) seenCache[id] = [];
          if (seenCache[id].indexOf(relay.url) === -1) seenCache[id].push(relay.url);
        }
      }
    );

    search = _pool.subscribeMany(DEFAULT_SEARCH_RELAYS, [{ kinds: [wikiKind], search: query }], {
      id: 'find-search',
      onevent(evt) {
        if (addUniqueTaggedReplaceable(results, evt)) update();
      }
    });
  }

  const debouncedPerformSearch = debounce(performSearch, 400);

  function openArticle(result: Event, ev?: MouseEvent, direct?: boolean) {
    let articleTab: ArticleTab = {
      id: next(),
      type: 'article',
      data: [getTagOr(result, 'd'), result.pubkey],
      relayHints: seenCache[result.id],
      actualEvent: result
    };
    if (ev?.button === 1) createChild(articleTab);
    else if (direct)
      // if this is called with 'direct' we won't give it a back button
      replaceSelf(articleTab);
    else replaceSelf({ ...articleTab, back: tab }); // otherwise we will
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
    if (query !== searchTab.data) {
      // replace browser url and history
      let index = $tabs.findIndex((t) => t.id === tab.id);
      let replacementURL = $page.url.pathname.split('/').slice(1);
      replacementURL[index] = query;

      let currentState = $page.state as [number, Tab];
      replaceState('/' + replacementURL.join('/'), currentState[0] === index ? [] : currentState);

      // redo the query
      debouncedPerformSearch();
    }
  }
</script>

<div class="mt-2 font-bold text-4xl">
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
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
        replaceSelf({ id: next(), type: 'editor', data: { title: query, previous: tab } });
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
