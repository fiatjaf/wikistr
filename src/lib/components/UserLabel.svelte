<script lang="ts">
  import { onMount } from 'svelte';
  import { NoteCollection, RequestBuilder } from '@snort/system';

  import { system } from '$lib/nostr';

  export let pubkey: string;
  let metadata: { name: string; picture: string };

  $: name = metadata?.name || pubkey.slice(0, 4);

  onMount(() => {
    const rb = new RequestBuilder('user-metadata');
    rb.withFilter().kinds([0]).authors([pubkey]);

    const q = system.Query(NoteCollection, rb);
    q.onEvent = (_, evt) => {
      try {
        metadata = JSON.parse(evt.content);
        q.cancel();
      } catch (err) {
        /***/
      }
    };

    return () => q.cancel();
  });
</script>

<span class="text-gray-600 font-[600]">{name}</span>
