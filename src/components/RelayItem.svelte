<script lang="ts">
  import type { RelayCard, Card } from '$lib/types';
  import { next, urlWithoutScheme } from '$lib/utils';

  export let url: string;
  export let createChild: (card: Card) => void;

  function openRelay(relay: string) {
    let relayCard: RelayCard = { id: next(), type: 'relay', data: relay };
    createChild(relayCard);
  }
</script>

<button
  class="font-normal text-xs px-1 py-0.5 mr-1 my-0.5 rounded bg-emerald-200 cursor-pointer hover:bg-emerald-400 transition-colors"
  on:mouseup|preventDefault={openRelay.bind(null, url)}
>
  {urlWithoutScheme(url)}
</button>
