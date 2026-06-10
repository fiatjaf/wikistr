<script lang="ts">
  import { next } from '$lib/utils';

  import type { SearchCard, Card } from '$lib/types';
  import { normalizeIdentifier } from '@nostr/tools/nip54';

  interface Props {
    replaceNewCard: (card: Card) => void;
  }

  let { replaceNewCard }: Props = $props();
  let query = $state('');
  let newTitle = $state('');

  function search(ev: SubmitEvent) {
    ev.preventDefault();

    if (query) {
      const newCard: SearchCard = {
        id: next(),
        type: 'find',
        data: normalizeIdentifier(query),
        preferredAuthors: [],
        redirect: false
      };
      replaceNewCard(newCard);
      query = '';
    }
  }

  function createArticle(ev: SubmitEvent) {
    ev.preventDefault();

    if (newTitle) {
      replaceNewCard({
        id: next(),
        type: 'editor',
        data: {
          title: newTitle,
          summary: '',
          content: ''
        }
      } as any);
      newTitle = '';
    }
  }
</script>

<div>
  <div class="text-sm font-semibold text-gray-700 mb-2">Search for an article:</div>
  <form onsubmit={search} class="flex rounded-md shadow-sm mb-6">
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

  <div class="border-t border-stone-200 pt-6">
    <div class="text-sm font-semibold text-gray-700 mb-2">Or, create a new article:</div>
    <form onsubmit={createArticle} class="flex rounded-md shadow-sm">
      <div class="relative flex items-stretch flex-grow focus-within:z-10">
        <input
          bind:value={newTitle}
          class="focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
          placeholder="e.g., Quantum physics"
        />
      </div>
      <button
        type="submit"
        class="-ml-px inline-flex items-center space-x-2 px-3 py-2 border border-gray-300 text-sm font-medium rounded-r-md bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-white"
        >Create</button
      >
    </form>
  </div>
</div>
