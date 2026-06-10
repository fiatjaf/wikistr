<script lang="ts">
  import { onMount } from 'svelte';
  import debounce from 'debounce';
  import type { NostrEvent } from '@nostr/tools/pure';

  import type { ArticleCard, UserCard, Card } from '$lib/types';
  import { addUniqueTaggedReplaceable, getTagOr, next } from '$lib/utils';
  import { wikiKind } from '$lib/nostr';
  import ArticleListItem from '$components/ArticleListItem.svelte';
  import UserLabel from '$components/UserLabel.svelte';
  import { subscribeOutbox } from '$lib/outbox';

  interface Props {
    card: UserCard;
    createChild: (card: Card) => void;
  }

  let { card, createChild }: Props = $props();
  let seenCache: { [id: string]: string[] } = {};
  let results = $state<NostrEvent[]>([]);
  let tried = $state(false);

  onMount(() => {
    const update = debounce(() => {
      results = results;
      seenCache = seenCache;
    }, 500);

    setTimeout(() => {
      tried = true;
    }, 1500);

    let sub = subscribeOutbox(
      card.data,
      {
        kinds: [wikiKind],
        limit: 50
      },
      {
        receivedEvent(relay: any, id: string) {
          if (!(id in seenCache)) seenCache[id] = [];
          if (seenCache[id].indexOf(relay.url) === -1) seenCache[id].push(relay.url);
        },
        onevent(evt: NostrEvent) {
          if (addUniqueTaggedReplaceable(results, evt)) update();
        }
      }
    );

    return sub.close;
  });

  function openArticle(result: NostrEvent) {
    let articleCard: ArticleCard = {
      id: next(),
      type: 'article',
      data: [getTagOr(result, 'd'), result.pubkey],
      relayHints: seenCache[result.id] || [],
      actualEvent: result
    };
    createChild(articleCard);
  }
</script>

<div class="mb-0 text-2xl break-all">
  <UserLabel pubkey={card.data} />
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
