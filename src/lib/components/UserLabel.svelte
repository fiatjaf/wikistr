<script lang="ts">
  import { onMount } from 'svelte';
  import { nip19 } from 'nostr-tools';
  import type { MetadataCache } from '@snort/system';

  import { system } from '$lib/nostr';

  export let pubkey: string;
  let metadata: MetadataCache;
  let npub = nip19.npubEncode(pubkey);

  $: name = metadata?.name || npub.slice(0, 11);
  $: picture = metadata?.picture;

  onMount(() => {
    system.ProfileLoader.TrackMetadata(pubkey);

    const release = system.ProfileLoader.Cache.hook(() => {
      let val = system.ProfileLoader.Cache.getFromCache(pubkey);
      if (val) {
        metadata = val;
      }
      system.ProfileLoader.UntrackMetadata(pubkey);
      release();
    }, pubkey);

    return release;
  });
</script>

<div class="inline-flex items-center h-3">
  {#if picture}
    <img src={picture} class="h-full ml-1" alt="user avatar" />&nbsp;
  {/if}
  <span class="text-gray-600 font-[600]" title={npub}>{name}</span>
</div>
