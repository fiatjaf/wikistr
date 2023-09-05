<script lang="ts">
  import { onMount } from 'svelte';
  import { nip19 } from 'nostr-tools';
  import { NoteCollection, RequestBuilder, type StoreSnapshot } from '@snort/system';

  import { system } from '$lib/nostr';

  export let pubkey: string;
  let metadata: { name: string; picture: string };
  let npub = nip19.npubEncode(pubkey);

  $: name = metadata?.name || npub.slice(0, 11);

  onMount(() => {
    const rb = new RequestBuilder(`user:${pubkey.slice(-8)}`);
    rb.withFilter().kinds([0]).authors([pubkey]);

    const q = system.Query(NoteCollection, rb);
    const release = q.feed.hook(() => {
      const state = q.feed.snapshot as StoreSnapshot<ReturnType<NoteCollection['getSnapshotData']>>;
      if (state.data?.length) {
        try {
          metadata = JSON.parse(state.data[0].content);
          cancel();
        } catch (err) {
          /***/
        }
      }
    });

    function cancel() {
      release();
      q.cancel();
    }

    return cancel;
  });
</script>

<span class="text-gray-600 font-[600]" title={npub}>{name}</span>
