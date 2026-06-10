<script lang="ts">
  import { onMount } from 'svelte';
  import { DEFAULT_WIKI_RELAYS } from '$lib/defaults';

  let customRelays = $state<string[]>([]);
  let newRelay = $state('');

  onMount(() => {
    const stored = localStorage.getItem('wikistr:custom-relays');
    if (stored) {
      try {
        customRelays = JSON.parse(stored);
      } catch (e) {
        customRelays = [];
      }
    }
  });

  function addRelay() {
    const url = newRelay.trim();
    if (!url) return;
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      alert('Relay URL must start with wss:// or ws://');
      return;
    }
    if (customRelays.includes(url)) {
      alert('Relay already added');
      return;
    }
    customRelays = [...customRelays, url];
    newRelay = '';
  }

  function removeRelay(url: string) {
    customRelays = customRelays.filter((r) => r !== url);
  }

  function saveData() {
    localStorage.setItem('wikistr:custom-relays', JSON.stringify(customRelays));
    window.location.reload();
  }
</script>

<div class="p-6 max-w-xl mx-auto bg-white rounded-xl shadow-md space-y-6 border border-stone-100">
  <div>
    <h2 class="text-2xl font-bold text-stone-900">Configure Relays</h2>
    <p class="text-sm text-stone-500 mt-1">
      Add or remove custom Nostr relays used to read and publish wiki articles.
    </p>
  </div>

  <!-- Add Relay Form -->
  <div class="space-y-2">
    <label for="relay-url" class="block text-sm font-medium text-stone-700">Add Custom Relay</label>
    <div class="flex gap-2">
      <input
        id="relay-url"
        type="text"
        placeholder="wss://relay.example.com"
        bind:value={newRelay}
        onkeydown={(e) => e.key === 'Enter' && addRelay()}
        class="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-stone-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      />
      <button
        onclick={addRelay}
        type="button"
        class="inline-flex items-center px-4 py-2 border border-stone-300 text-sm font-medium rounded-md shadow-sm text-stone-700 bg-white hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Add
      </button>
    </div>
  </div>

  <!-- Custom Relays List -->
  <div class="space-y-3">
    <h3 class="text-sm font-semibold text-stone-800 uppercase tracking-wider">Your Custom Relays</h3>
    {#if customRelays.length === 0}
      <div class="text-sm text-stone-400 italic py-2">No custom relays configured. Default relays will be used.</div>
    {:else}
      <div class="divide-y divide-stone-100 max-h-60 overflow-y-auto pr-1 border border-stone-100 rounded-md">
        {#each customRelays as url}
          <div class="flex items-center justify-between py-2.5 px-3 hover:bg-stone-50 transition-colors">
            <span class="text-sm font-mono text-stone-600 truncate mr-4">{url}</span>
            <button
              onclick={() => removeRelay(url)}
              type="button"
              class="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors"
            >
              Remove
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Default Relays Reference -->
  <div class="space-y-2 pt-2 border-t border-stone-100">
    <h3 class="text-xs font-semibold text-stone-400 uppercase tracking-wider">Default Relays (Active if no custom)</h3>
    <div class="flex flex-wrap gap-1.5">
      {#each DEFAULT_WIKI_RELAYS as url}
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-800 font-mono">
          {url.replace('wss://', '')}
        </span>
      {/each}
    </div>
  </div>

  <!-- Save actions -->
  <div class="pt-4 border-t border-stone-100 flex justify-end">
    <button
      onclick={saveData}
      type="button"
      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
    >
      Save & Reload
    </button>
  </div>
</div>
