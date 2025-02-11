<script lang="ts">
  import { onMount } from 'svelte';
  import { loadNostrUser, type NostrUser } from '$lib/metadata';
  import type { Card, UserCard } from '$lib/types';
  import { next } from '$lib/utils';

  export let pubkey: string;
  let user: NostrUser | null = null;

  export let createChild: ((card: Card) => void) | undefined = undefined;

  onMount(async () => {
    user = await loadNostrUser(pubkey);
  });

  function handleClick() {
    if (createChild) {
      createChild({ id: next(), type: 'user', data: pubkey } as UserCard);
    }
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="inline-flex items-center h-3 max-w-[45%]"
  class:cursor-pointer={!!createChild}
  on:click={handleClick}
>
  {#if user?.image}
    <img src={user.image} class="h-full ml-1" alt="user avatar" />&nbsp;
  {/if}
  <span class="text-gray-600 font-[600] text-ellipsis truncate" title={user?.npub}
    >{user?.shortName || pubkey}</span
  >
</div>
