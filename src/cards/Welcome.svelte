<script lang="ts">
  import { parsePlainText } from '$lib/articleParser';
  import { onMount } from 'svelte';
  import type { Event } from 'nostr-tools/pure';

  import { signer, userPreferredRelays, wikiKind, account, _pool, getTagOr } from '$lib/nostr';
  import type { Tab } from '$lib/types';
  import UserLabel from '$components/UserLabel.svelte';
  import { getA, next } from '$lib/utils';
  import { debounce } from 'debounce';

  let results: Event[] = [];
  export let createChild: (tab: Tab) => void;

  onMount(() => {
    const update = debounce(() => {
      results = results;
    }, 500);

    let sub = _pool.subscribeMany(
      $userPreferredRelays.read,
      [
        {
          kinds: [wikiKind],
          limit: 12
        }
      ],
      {
        onevent(evt) {
          results.push(evt);
          update();
        }
      }
    );

    return sub.close;
  });

  function openArticle(result: Event) {
    createChild({ id: next(), type: 'article', data: [getTagOr(result, 'd'), result.pubkey] });
  }

  function doLogin() {
    signer.getPublicKey();
  }
</script>

<div class="font-bold text-4xl">Account</div>
<div class="mb-4 mt-2">
  {#if $account}
    <div class="flex h-12">
      {#if $account.image}
        <img class="full-h" src={$account.image} alt="user avatar" />
      {/if}
      <div class="ml-2">
        <p class="w-64 text-ellipsis overflow-hidden">{$account.npub}</p>
        <p>{$account.shortName}</p>
      </div>
    </div>
  {:else}
    <button
      on:click={doLogin}
      type="submit"
      class="inline-flex items-center space-x-2 px-3 py-2 border border-gray-300 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-white"
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
