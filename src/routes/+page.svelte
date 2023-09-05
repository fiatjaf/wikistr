<script lang="ts">
  import { createChildEverywhere, tabs } from '$lib/state';
  import TabElement from '$lib/Card.svelte';
  import Searchbar from '$components/Searchbar.svelte';
  import { scrollTabIntoView } from '$lib/utils';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import type { Tab } from '$lib/types';

  onMount(() => {
    if (!$tabs.find((e) => e.id == 0)) {
      let openShareArticle = $page.url.searchParams.get('d') || undefined; // d = default/welcome tab to load
      if (openShareArticle) {
        let newTab: Tab = { id: 0, type: 'article', data: openShareArticle };
        $tabs.push(newTab);
        tabs.set($tabs);
        scrollTabIntoView(String(newTab.id), true);
      } else {
        let newTab: Tab = { id: 0, type: 'welcome' };
        $tabs.push(newTab);
        tabs.set($tabs);
      }
    }

    if ($page.url.searchParams.get('createChildEverywhere') !== null) {
      createChildEverywhere.set(true);
    }
  });
</script>

<div class="flex overflow-x-scroll pb-2 scroll-smooth">
  {#each $tabs as tab (tab.id)}
    <TabElement {tab} />
  {/each}
  <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
  <div
    id={`wikitab-v0-special-search`}
    class="
overflow-y-auto
overflow-x-hidden
mx-2 p-4 mt-2
min-w-[365px] max-w-[365px] lg:min-w-[32rem] lg:max-w-[32rem]
rounded-lg border border-slate-500 bg-slate-50
h-[calc(100vh_-_32px)]"
    on:click={(ev) => scrollTabIntoView(ev.currentTarget, false)}
  >
    <div class="p-6"><Searchbar /></div>
  </div>
</div>
