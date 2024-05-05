<script lang="ts">
  import { onMount } from 'svelte';
  import { loadNostrUser, type NostrUser } from '$lib/metadata';

  export let pubkey: string;
  let user: NostrUser | null = null;

  onMount(async () => {
    user = await loadNostrUser(pubkey);
  });
</script>

<div class="inline-flex items-center h-3">
  {#if user?.image}
    <img src={user.image} class="h-full ml-1" alt="user avatar" />&nbsp;
  {/if}
  <span class="text-gray-600 font-[600]" title={user?.npub}>{user?.shortName || pubkey}</span>
</div>
