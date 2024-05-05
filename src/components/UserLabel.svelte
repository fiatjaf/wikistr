<script lang="ts">
  import { onMount } from 'svelte';
  import * as nip19 from 'nostr-tools/nip19';

  import { getMetadata, type Metadata } from '$lib/nostr';

  export let pubkey: string;
  let metadata: Metadata;
  let npub = nip19.npubEncode(pubkey);

  $: name = metadata?.name && metadata.name.trim() !== '' ? metadata.name : npub.slice(0, 11);
  $: picture = metadata?.picture;

  onMount(async () => {
    metadata = await getMetadata(pubkey);
  });
</script>

<div class="inline-flex items-center h-3">
  {#if picture}
    <img src={picture} class="h-full ml-1" alt="user avatar" />&nbsp;
  {/if}
  <span class="text-gray-600 font-[600]" title={npub}>{name}</span>
</div>
