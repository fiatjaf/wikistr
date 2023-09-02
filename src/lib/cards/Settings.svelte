<script lang="ts">
  import { getStaticRelays, saveStaticRelays } from '$lib/nostr';

  let relays = getStaticRelays();
  let newRelay = '';

  function removeRelay(index: number) {
    relays.splice(index, 1);
    relays = [...relays];
  }

  function addRelay() {
    if (newRelay) {
      relays.push(newRelay);
      newRelay = '';
      relays = [...relays];
    }
  }

  function saveData() {
    addRelay();
    saveStaticRelays(relays);
    setTimeout(() => {
      window.location.href = '';
    }, 1);
  }
</script>

<div class="mx-4 mt-4 w-5/6">
  <!-- Relay Selection -->
  <div class="mb-6">
    <p class="text-sm">Relays</p>
    {#each relays as relay, index}
      <div>
        <button class="text-red-500" on:click={() => removeRelay(index)}> - </button>
        {relay}
      </div>
    {/each}
    <div>
      <button on:click={addRelay} class="text-green-500"> + </button>
      <input
        bind:value={newRelay}
        type="text"
        class="inline shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
        placeholder="wss://relay.example.com"
      />
    </div>
  </div>

  <!-- Save button -->
  <button
    on:click={saveData}
    type="button"
    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
  >
    Save & Reload
  </button>
</div>
