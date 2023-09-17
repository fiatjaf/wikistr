<script lang="ts">
  import { tabs } from '$lib/state';
  import { next, scrollTabIntoView } from '$lib/utils';
  import type { Tab } from '$lib/types';

  let query = '';

  function search() {
    if (query) {
      let newTabs = $tabs;
      const newTab: Tab = {
        id: next(),
        type: 'find',
        data: query.toLowerCase().replaceAll(' ', '-')
      };
      newTabs.push(newTab);
      tabs.set(newTabs);
      scrollTabIntoView(String(newTab.id), true);
      query = '';
    }
  }
</script>

<form on:submit|preventDefault={search} class="mt- flex rounded-md shadow-sm">
  <div class="relative flex items-stretch flex-grow focus-within:z-10">
    <input
      bind:value={query}
      class="focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
      placeholder="article name"
    />
  </div>
  <button
    type="submit"
    class="-ml-px relative inline-flex items-center space-x-2 px-3 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-white"
    >Go</button
  >
</form>
