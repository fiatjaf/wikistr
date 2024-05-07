<script lang="ts">
  import { onMount } from 'svelte';
  import { debounce } from 'debounce';
  import type { Event } from 'nostr-tools';

  import type { ArticleTab, Tab } from '$lib/types';
  import { getTagOr, next, urlWithoutScheme } from '$lib/utils';
  import { _pool, wikiKind } from '$lib/nostr';
  import ArticleListItem from '$components/ArticleListItem.svelte';

  export let tab: Tab;
  export let replaceSelf: (tab: Tab) => void;
  export let createChild: (tab: Tab) => void;
  let results: Event[] = [];
  let tried = false;

  onMount(() => {
    const update = debounce(() => {
      results = results;
    }, 500);

    setTimeout(() => {
      tried = true;
    }, 1500);

    let sub = _pool.subscribeMany(
      [tab.data],
      [
        {
          kinds: [wikiKind],
          limit: 25
        }
      ],
      {
        oneose() {
          tried = true;
        },
        onevent(evt) {
          tried = true;
          results.push(evt);
          update();
        }
      }
    );

    return sub.close;
  });

  function openArticle(result: Event, ev: MouseEvent) {
    let articleTab: ArticleTab = {
      id: next(),
      type: 'article',
      data: [getTagOr(result, 'd'), result.pubkey],
      relayHints: [tab.data]
    };
    if (ev.button === 1) createChild(articleTab);
    else replaceSelf(articleTab);
  }
</script>

<div class="mb-0 text-2xl break-all">{urlWithoutScheme(tab.data)}</div>
{#each results as result (result.id)}
  <ArticleListItem event={result} {openArticle} />
{/each}
{#if tried && results.length === 0}
  <div class="px-4 py-5 bg-white border-2 border-stone rounded-lg mt-2 min-h-[48px]">
    <p class="mb-2">No articles found in this relay.</p>
  </div>
{:else if !tried}
  <div class="px-4 py-5 rounded-lg mt-2 min-h-[48px]">Loading...</div>
{/if}
