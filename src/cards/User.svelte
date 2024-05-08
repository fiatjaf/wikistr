<script lang="ts">
  import { onMount } from 'svelte';
  import { debounce } from 'debounce';
  import type { NostrEvent } from 'nostr-tools';

  import type { ArticleTab, Tab } from '$lib/types';
  import { getTagOr, next } from '$lib/utils';
  import { _pool, wikiKind } from '$lib/nostr';
  import ArticleListItem from '$components/ArticleListItem.svelte';
  import UserLabel from '$components/UserLabel.svelte';
  import { subscribeOutbox } from '$lib/outbox';

  export let tab: Tab;
  export let replaceSelf: (tab: Tab) => void;
  export let createChild: (tab: Tab) => void;
  let seenCache: { [id: string]: string[] } = {};
  let results: NostrEvent[] = [];
  let tried = false;

  onMount(() => {
    const update = debounce(() => {
      results = results;
      seenCache = seenCache;
    }, 500);

    setTimeout(() => {
      tried = true;
    }, 1500);

    let sub = subscribeOutbox(
      tab.data,
      {
        kinds: [wikiKind],
        limit: 50
      },
      {
        receivedEvent(relay, id) {
          if (!(id in seenCache)) seenCache[id] = [];
          if (seenCache[id].indexOf(relay.url) === -1) seenCache[id].push(relay.url);
        },
        onevent(evt) {
          results.push(evt);
          update();
        }
      }
    );

    return sub.close;
  });

  function openArticle(result: NostrEvent, ev?: MouseEvent) {
    let articleTab: ArticleTab = {
      id: next(),
      type: 'article',
      data: [getTagOr(result, 'd'), result.pubkey],
      relayHints: seenCache[result.id] || [],
      actualEvent: result
    };
    if (ev?.button === 1) createChild(articleTab);
    else replaceSelf(articleTab);
  }
</script>

<div class="mb-0 text-2xl break-all">
  <UserLabel pubkey={tab.data} />
</div>
{#each results as result (result.id)}
  <ArticleListItem event={result} {openArticle} />
{/each}
{#if tried && results.length === 0}
  <div class="px-4 py-5 bg-white border-2 border-stone rounded-lg mt-2 min-h-[48px]">
    <p class="mb-2">No articles found for this user.</p>
  </div>
{:else if !tried}
  <div class="px-4 py-5 rounded-lg mt-2 min-h-[48px]">Loading...</div>
{/if}
