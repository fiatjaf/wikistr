<script lang="ts">
  import type { NostrEvent } from '@nostr/tools/pure';
  import { onMount } from 'svelte';
  import { pool } from '@nostr/gadgets/global';
  import { reactionKind, wikiKind } from '$lib/nostr';
  import { DEFAULT_SEARCH_RELAYS } from '$lib/defaults';

  import UserLabel from './UserLabel.svelte';
  import { formatDate } from '$lib/utils';

  interface Props {
    openArticle: (event: NostrEvent, ev: MouseEvent) => void;
    event: NostrEvent;
  }

  let { openArticle, event }: Props = $props();

  let reactionEvents = $state<NostrEvent[]>([]);
  let authoritativeCount = $derived(reactionEvents.filter(r => r.content === '✅').length);

  let plainText = $derived(
    event.content
      .slice(0, 210)
      .replace(/\[\[(.*?)\]\]/g, (_: any, content: any) => {
        return content;
      })
      .slice(0, 190)
  );

  function handleClick(ev: MouseEvent) {
    try {
      openArticle(event, ev);
    } catch (err) {
      alert("Error opening article: " + err);
    }
  }

  onMount(() => {
    const dTag = event.tags.find((e) => e[0] === 'd')?.[1];
    if (!dTag) return;
    const sub = pool.subscribeMany(
      DEFAULT_SEARCH_RELAYS,
      [
        {
          kinds: [reactionKind],
          '#a': [`${wikiKind}:${event.pubkey}:${dTag}`]
        }
      ],
      {
        onevent(evt) {
          if (!reactionEvents.some(r => r.id === evt.id)) {
            reactionEvents = [...reactionEvents, evt];
          }
        }
      }
    );
    return () => sub.close();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  onmouseup={handleClick}
  class="cursor-pointer p-4 bg-white border-2 border-stone-200 hover:bg-stone-50 rounded-lg mt-2"
>
  <h1 class="flex items-center gap-1.5 font-bold text-lg">
    <span>
      {event.tags.find((e) => e[0] == 'title')?.[0] && event.tags.find((e) => e[0] == 'title')?.[1]
        ? event.tags.find((e) => e[0] == 'title')?.[1]
        : event.tags.find((e) => e[0] == 'd')?.[1]}
    </span>
    {#if authoritativeCount > 0}
      <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-200" title={`${authoritativeCount} users marked this as authoritative`}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3 text-emerald-600">
          <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" />
        </svg>
        <span>{authoritativeCount}</span>
      </span>
    {/if}
  </h1>
  <p class="text-xs my-1">
    by&nbsp;<span class="-ml-1"><UserLabel pubkey={event.pubkey} /></span>
    {formatDate(event.created_at)}
  </p>
  <p class="text-xs text-wrap break-words whitespace-pre-wrap">
    {#if event.tags.find((e) => e[0] == 'summary')?.[0] && event.tags.find((e) => e[0] == 'summary')?.[1]}
      {event.tags
        .find((e) => e[0] == 'summary')?.[1]
        .slice(
          0,
          192
        )}{#if String(event.tags.find((e) => e[0] == 'summary')?.[1])?.length > 192}...{/if}
    {:else}
      {plainText.length <= 170 ? plainText : plainText.substring(0, 167) + '...'}
    {/if}
  </p>
</div>
