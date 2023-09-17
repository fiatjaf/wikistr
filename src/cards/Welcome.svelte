<script lang="ts">
  import { parsePlainText } from '$lib/articleParser';
  import { onMount } from 'svelte';
  import { nip19, type Event } from 'nostr-tools';

  import { cachingSub, signer, userPreferredRelays, getA, wikiKind, account } from '$lib/nostr';
  import type { Tab } from '$lib/types';
  import UserLabel from '$components/UserLabel.svelte';
  import { next } from '$lib/utils';

  let results: Event[] = [];
  export let createChild: (tab: Tab) => void;

  onMount(() => {
    return cachingSub(
      'recent',
      $userPreferredRelays,
      { kinds: [wikiKind], limit: 12 },
      handleUpdate,
      getA
    );
    function handleUpdate(events: Event[]) {
      results = events;
    }
  });

  function openArticle(result: Event) {
    createChild({ id: next(), type: 'article', data: result.id });
  }

  function doLogin() {
    signer.getPublicKey();
  }
</script>

<div class="font-bold text-4xl">Account</div>
<div class="mb-4 mt-2">
  {#if $account}
    <div class="flex h-12">
      {#if $account.picture}
        <img class="full-h" src={$account.picture} alt="user avatar" />
      {/if}
      <div class="ml-2">
        <p class="w-64 text-ellipsis overflow-hidden">{nip19.npubEncode($account.pubkey)}</p>
        <p>{$account.name}</p>
      </div>
    </div>
  {:else}
    <button
      on:click={doLogin}
      type="submit"
      class="inline-flex items-center space-x-2 px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-white"
      >Login</button
    >
  {/if}
</div>
<div class="mb-2 font-bold text-4xl">Recent Articles</div>
{#each results as result}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    on:mouseup|preventDefault={openArticle.bind(null, result)}
    class="cursor-pointer p-4 bg-white border border-gray-300 hover:bg-slate-50 rounded-lg mt-2"
  >
    <h1>
      {result.tags.find((e) => e[0] == 'title')?.[0] &&
      result.tags.find((e) => e[0] == 'title')?.[1]
        ? result.tags.find((e) => e[0] == 'title')?.[1]
        : result.tags.find((e) => e[0] == 'd')?.[1]}
    </h1>
    <p class="text-xs">
      <!-- implement published at? -->
      <!-- {#if result.tags.find((e) => e[0] == "published_at")}
                on {formatDate(result.tags.find((e) => e[0] == "published_at")[1])}
                {/if} -->
      by <UserLabel pubkey={result.pubkey} />
    </p>
    <p class="text-xs">
      {#if result.tags.find((e) => e[0] == 'summary')?.[0] && result.tags.find((e) => e[0] == 'summary')?.[1]}
        {result.tags
          .find((e) => e[0] == 'summary')?.[1]
          .slice(
            0,
            192
          )}{#if String(result.tags.find((e) => e[0] == 'summary')?.[1])?.length > 192}...{/if}
      {:else}
        {result.content.length <= 192
          ? parsePlainText(result.content.slice(0, 189))
          : parsePlainText(result.content.slice(0, 189)) + '...'}
      {/if}
    </p>
  </div>
{/each}
