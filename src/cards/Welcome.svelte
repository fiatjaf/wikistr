<script lang="ts">
  import {
    signer,
    account,
    userWikiRelays
  } from '$lib/nostr';
  import type { ArticleCard, Card } from '$lib/types';
  import { next, urlWithoutScheme } from '$lib/utils';
  import { onMount } from 'svelte';
  import New from './New.svelte';
  import { fetchPrivateTagsFromRelays } from '$lib/privateTagsSync';

  interface Props {
    createChild: (card: Card) => void;
  }

  let { createChild }: Props = $props();

  let pinnedList = $state<{ dTag: string; pubkey: string; title: string }[]>([]);
  let historyList = $state<{ dTag: string; pubkey: string; title: string; timestamp: number }[]>([]);
  let showRelays = $state(false);
  let privateTagsMap = $state<{ [tag: string]: { dTag: string; pubkey: string; title: string }[] }>({});
  let activePrivateTag = $state<string | null>(null);

  function loadPrivateTagsMap() {
    try {
      const stored = localStorage.getItem('wikistr:private-tags');
      const allPrivateTags = stored ? JSON.parse(stored) : {};
      
      const storedPinned = localStorage.getItem('wikistr:pinned');
      const pinned = storedPinned ? JSON.parse(storedPinned) : [];
      const storedHistory = localStorage.getItem('wikistr:history');
      const history = storedHistory ? JSON.parse(storedHistory) : [];
      const allItems = [...pinned, ...history];
      
      const map: typeof privateTagsMap = {};
      
      Object.entries(allPrivateTags).forEach(([key, tags]) => {
        const [pubkey, dTag] = key.split(':');
        const match = allItems.find((x) => x.dTag === dTag && x.pubkey === pubkey);
        const title = match ? match.title : dTag;
        
        if (Array.isArray(tags)) {
          tags.forEach((tag) => {
            if (!map[tag]) map[tag] = [];
            map[tag].push({ dTag, pubkey, title });
          });
        }
      });
      
      privateTagsMap = map;
    } catch (e) {
      console.error(e);
    }
  }

  function loadDashboardData() {
    try {
      const storedPinned = localStorage.getItem('wikistr:pinned');
      pinnedList = storedPinned ? JSON.parse(storedPinned) : [];
      if (!Array.isArray(pinnedList)) pinnedList = [];

      const storedHistory = localStorage.getItem('wikistr:history');
      historyList = storedHistory ? JSON.parse(storedHistory) : [];
      if (!Array.isArray(historyList)) historyList = [];

      loadPrivateTagsMap();
    } catch (e) {
      console.error(e);
    }
  }

  function openArticleByCoordinate(dTag: string, pubkey: string) {
    createChild({
      id: next(),
      type: 'article',
      data: [dTag, pubkey],
      relayHints: []
    } as ArticleCard);
  }

  onMount(() => {
    loadDashboardData();
    window.addEventListener('storage', loadDashboardData);
    window.addEventListener('wikistr:dashboard-update', loadDashboardData);
    
    const unsubAccount = account.subscribe((acc) => {
      if (acc) {
        fetchPrivateTagsFromRelays(acc.pubkey);
      }
    });

    return () => {
      window.removeEventListener('storage', loadDashboardData);
      window.removeEventListener('wikistr:dashboard-update', loadDashboardData);
      unsubAccount();
    };
  });

  function doLogin() {
    signer.getPublicKey();
  }

  function replaceNewCard(newCard: Card) {
    createChild(newCard);
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
      onclick={doLogin}
      type="submit"
      class="inline-flex items-center space-x-2 px-3 py-2 border border-gray-300 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-white"
      >Login</button
    >
  {/if}
</div>

<div class="my-6 p-4 border border-stone-200 rounded-lg bg-stone-50/50">
  <New {replaceNewCard} />
</div>

{#if pinnedList.length > 0}
  <div class="my-6 p-4 border border-stone-200 rounded-lg bg-stone-50/50">
    <h2 class="font-bold text-lg text-stone-700 mb-3 flex items-center space-x-2">
      <svg xmlns="http://www.w3.org/2000/svg" fill="#eab308" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-amber-500">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
      </svg>
      <span>Pinned Pages</span>
    </h2>
    <div class="space-y-2">
      {#each pinnedList as pin}
        <button 
          onclick={() => openArticleByCoordinate(pin.dTag, pin.pubkey)}
          class="w-full text-left p-2 rounded bg-white border border-stone-100 hover:border-indigo-300 hover:shadow-sm transition-all text-sm font-medium text-stone-800 flex items-center justify-between"
        >
          <span class="truncate">{pin.title}</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 text-stone-400">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      {/each}
    </div>
  </div>
{/if}

{#if historyList.length > 0}
  <div class="my-6 p-4 border border-stone-200 rounded-lg bg-stone-50/50">
    <h2 class="font-bold text-lg text-stone-700 mb-3 flex items-center space-x-2">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-indigo-500">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <span>Recently Viewed</span>
    </h2>
    <div class="space-y-2">
      {#each historyList as hist}
        <button 
          onclick={() => openArticleByCoordinate(hist.dTag, hist.pubkey)}
          class="w-full text-left p-2 rounded bg-white border border-stone-100 hover:border-indigo-300 hover:shadow-sm transition-all text-sm font-medium text-stone-800 flex items-center justify-between"
        >
          <span class="truncate">{hist.title}</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 text-stone-400">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      {/each}
    </div>
  </div>
{/if}

{#if Object.keys(privateTagsMap).length > 0}
  <div class="my-6 p-4 border border-stone-200 rounded-lg bg-stone-50/50">
    <h2 class="font-bold text-lg text-stone-700 mb-3 flex items-center space-x-2">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-amber-500">
        <path fill-rule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clip-rule="evenodd" />
      </svg>
      <span>Your Private Tags</span>
    </h2>
    <div class="flex flex-wrap gap-1.5 mb-3">
      {#each Object.keys(privateTagsMap) as tag}
        <button 
          onclick={() => activePrivateTag = activePrivateTag === tag ? null : tag}
          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border transition-all {activePrivateTag === tag ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-sm' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}"
        >
          #{tag} ({privateTagsMap[tag].length})
        </button>
      {/each}
    </div>
    
    {#if activePrivateTag && privateTagsMap[activePrivateTag]}
      <div class="space-y-2 border-t border-stone-200/60 pt-3">
        {#each privateTagsMap[activePrivateTag] as item}
          <button 
            onclick={() => openArticleByCoordinate(item.dTag, item.pubkey)}
            class="w-full text-left p-2 rounded bg-white border border-stone-100 hover:border-indigo-300 hover:shadow-sm transition-all text-xs font-medium text-stone-700 flex items-center justify-between"
          >
            <span class="truncate">{item.title}</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5 text-stone-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<div class="my-6 p-4 border border-stone-200 rounded-lg bg-stone-50/50">
  <button 
    onclick={() => showRelays = !showRelays}
    class="flex items-center justify-between w-full font-bold text-lg text-stone-700 focus:outline-none"
  >
    <span class="flex items-center space-x-2">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-indigo-500">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699-2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
      </svg>
      <span>Relays ({$userWikiRelays.length})</span>
    </span>
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 transform transition-transform {showRelays ? 'rotate-180' : ''}">
      <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  </button>
  
  {#if showRelays}
    <div class="mt-4 space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
      {#each $userWikiRelays as url}
        <div class="flex items-center justify-between p-2 rounded bg-white border border-stone-100 hover:bg-stone-50 text-sm">
          <span class="font-mono text-stone-600 truncate mr-2">{urlWithoutScheme(url)}</span>
          <div class="flex items-center space-x-1.5 flex-shrink-0">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" title="Connected"></span>
            <button 
              onclick={() => createChild({ id: next(), type: 'relay', data: url })}
              class="text-xs text-indigo-600 hover:underline"
            >
              Details
            </button>
          </div>
        </div>
      {/each}
      <button 
        onclick={() => createChild({ id: next(), type: 'settings' })}
        class="w-full text-center py-1.5 mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-dashed border-indigo-200 rounded hover:border-indigo-400 bg-indigo-50/20 transition-all"
      >
        Configure Relays
      </button>
    </div>
  {/if}
</div>

