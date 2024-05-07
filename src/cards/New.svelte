<script lang="ts">
  import { next, normalizeArticleName } from '$lib/utils';
  import type { SearchTab, Tab } from '$lib/types';

  export let replaceNewTab: (tab: Tab) => void;
  let query = '';

  function search() {
    if (query) {
      const newTab: SearchTab = {
        id: next(),
        type: 'find',
        data: normalizeArticleName(query),
        preferredAuthors: []
      };
      replaceNewTab(newTab);
      query = '';
    }
  }
</script>

<form on:submit|preventDefault={search} class="mt- flex rounded-md shadow-sm">
  <div class="relative flex items-stretch flex-grow focus-within:z-10">
    <input
      bind:value={query}
      class="focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
      placeholder="article name or search term"
    />
  </div>
  <button
    type="submit"
    class="-ml-px inline-flex items-center space-x-2 px-3 py-2 border border-gray-300 text-sm font-medium rounded-r-md bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-white"
    >Go</button
  >
</form>
