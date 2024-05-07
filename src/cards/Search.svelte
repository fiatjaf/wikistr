<script lang="ts">
  import { onMount } from 'svelte';
  import { debounce } from 'debounce';
  import type { Event, SubCloser } from 'nostr-tools';

  import { _pool, wot, wikiKind, userWikiRelays } from '$lib/nostr';
  import type { ArticleTab, Tab } from '$lib/types';
  import { getTagOr, next, normalizeArticleName } from '$lib/utils';
  import { DEFAULT_SEARCH_RELAYS } from '$lib/defaults';
  import ArticleListItem from '$components/ArticleListItem.svelte';

  export let query: string;
  export let tab: Tab;
  export let replaceSelf: (tab: Tab) => void;
  export let createChild: (tab: Tab) => void;
  let seenCache: { [id: string]: string[] } = {};
  let results: Event[] = [];
  let tried = false;

  onMount(() => {
    setTimeout(() => {
      tried = true;
    }, 1500);

    const update = debounce(() => {
      // sort by exact matches first, then by wotness
      results = results.sort((a, b) => {
        if (getTagOr(a, 'd') === tab.data && getTagOr(b, 'd') !== tab.data) {
          return -1;
        } else if (getTagOr(b, 'd') === tab.data && getTagOr(a, 'd') !== tab.data) {
          return 1;
        } else {
          return $wot[b.pubkey] - $wot[a.pubkey];
        }
      });
    }, 500);

    let search: SubCloser, sub: SubCloser;
    (async () => {
      sub = _pool.subscribeMany(
        $userWikiRelays,
        [{ kinds: [wikiKind], '#d': [normalizeArticleName(query)], limit: 25 }],
        {
          oneose() {
            tried = true;
          },
          onevent(evt) {
            tried = true;
            results.push(evt);
            update();
          },
          receivedEvent(relay, id) {
            if (!(id in seenCache)) {
              seenCache[id] = [];
            }
            seenCache[id].push(relay.url);
          }
        }
      );

      search = _pool.subscribeMany(DEFAULT_SEARCH_RELAYS, [{ kinds: [wikiKind], search: query }], {
        onevent(evt) {
          results.push(evt);
          update();
        }
      });
    })();

    return () => {
      if (sub) sub.close();
      if (search) search.close();
    };
  });

  function openArticle(result: Event, ev: MouseEvent) {
    let articleTab: ArticleTab = {
      id: next(),
      type: 'article',
      data: [getTagOr(result, 'd'), result.pubkey],
      relayHints: seenCache[result.id]
    };
    if (ev.button === 1) createChild(articleTab);
    else replaceSelf(articleTab);
  }
</script>

<div class="mt-2 font-bold text-4xl">"{query}"</div>
{#each results as result (result.id)}
  <ArticleListItem event={result} {openArticle} />
{/each}
{#if tried}
  <div class="px-4 py-5 bg-white border-2 border-stone rounded-lg mt-2">
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
      class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      Add more relays
    </button>
  </div>
{:else}
  <div class="px-4 py-5 rounded-lg mt-2">Loading...</div>
{/if}
