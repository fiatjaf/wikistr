<script>
  import { tabs } from '$lib/state';
  import TabElement from '$components/TabElement.svelte';
  import Searchbar from '$components/Searchbar.svelte';
  import { scrollTabIntoView } from '$lib/utils';
  import '../app.postcss';
</script>

<svelte:head>
  <title>WikiNostr</title>
  <meta name="description" content={`A "wikipedia" client for nostr`} />
</svelte:head>

<div class="flex overflow-x-scroll pb-2 scroll-smooth">
  {#each $tabs as tab (tab.id)}
    <TabElement {tab} />
  {/each}

  <!-- this is just empty -->
  <slot />

  <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
  <div
    id={`wikitab-v0-special-search`}
    class="
overflow-y-auto
overflow-x-hidden
mx-2 p-4 mt-2
min-w-[395px] max-w-[395px] lg:min-w-[32rem] lg:max-w-[32rem]
rounded-lg border border-slate-500 bg-slate-50
h-[calc(100vh_-_32px)]"
    on:click={(ev) => scrollTabIntoView(ev.currentTarget, false)}
  >
    <div class="p-6"><Searchbar /></div>
  </div>
</div>
