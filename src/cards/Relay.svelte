<script lang="ts">
  import { onMount } from 'svelte';
  import { debounce } from 'debounce';
  import type { NostrEvent } from 'nostr-tools';

  import type { ArticleCard, Card } from '$lib/types';
  import { addUniqueTaggedReplaceable, getTagOr, next, urlWithoutScheme } from '$lib/utils';
  import { _pool, wikiKind } from '$lib/nostr';
  import ArticleListItem from '$components/ArticleListItem.svelte';

  export let card: Card;
  export let replaceSelf: (card: Card) => void;
  export let createChild: (card: Card) => void;
  let results: NostrEvent[] = [];
  let tried = false;

  onMount(() => {
    const update = debounce(() => {
      results = results;
    }, 500);

    setTimeout(() => {
      tried = true;
    }, 1500);

    let sub = _pool.subscribeMany(
      [card.data],
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
          if (addUniqueTaggedReplaceable(results, evt)) update();
        }
      }
    );

    return sub.close;
  });

  function openArticle(result: NostrEvent, ev: MouseEvent) {
    let articleCard: ArticleCard = {
      id: next(),
      type: 'article',
      data: [getTagOr(result, 'd'), result.pubkey],
      relayHints: [card.data],
      actualEvent: result
    };
    if (ev.button === 1) createChild(articleCard);
    else replaceSelf(articleCard);
  }
</script>

<div class="mb-0 text-2xl break-all">{urlWithoutScheme(card.data)}</div>
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
