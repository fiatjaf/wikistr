<script lang="ts">
  import { goto } from '$app/navigation';

  import { tabs } from '$lib/state';
  import type { Tab } from '$lib/types';
  import { scrollTabIntoView, isElementInViewport, toURL } from '$lib/utils';
  import Article from '$cards/Article.svelte';
  import Editor from '$cards/Editor.svelte';
  import Welcome from '$cards/Welcome.svelte';
  import Search from '$cards/Search.svelte';
  import Settings from '$cards/Settings.svelte';
  import Relay from '$cards/Relay.svelte';
  import New from '$lib/cards/New.svelte';

  export let tab: Tab;

  function close() {
    if (tab.type === 'editor' && tab.data.previous) replaceSelf(tab.data.previous);
    else removeSelf();
  }

  function removeSelf() {
    const index = $tabs.findIndex((item) => item.id === tab.id);
    if (index !== -1) {
      const newTabs = [...$tabs];
      newTabs.splice(index, 1);
      tabs.set(newTabs);
      goto(
        '/' +
          $tabs
            .map((tab) => toURL(tab))
            .filter((v) => v)
            .join('/')
      );
    }
  }

  function createChild(newChild: Tab) {
    newChild.parent = tab.id;
    const index = $tabs.findIndex((item) => item.id === tab.id);
    if (index !== -1) {
      const newTabs = $tabs.slice(0, index + 1).concat(newChild);
      tabs.set(newTabs);
      goto(
        '/' +
          $tabs
            .map((tab) => toURL(tab))
            .filter((v) => v)
            .join('/')
      );

      setTimeout(() => {
        if (!isElementInViewport(String(newChild.id))) {
          scrollTabIntoView(String(newChild.id), false);
        }
      }, 1);
    }
  }

  function replaceSelf(updatedTab: Tab) {
    updatedTab.parent = tab.parent;
    const index = $tabs.findIndex((item) => item.id === tab.id);
    if (index !== -1) {
      const newTabs = $tabs.slice();
      const removedChildren = newTabs.filter((item) => item.parent === tab.id);
      removedChildren.forEach((child) => {
        const childIndex = newTabs.indexOf(child);
        if (childIndex !== -1) {
          newTabs.splice(childIndex, 1);
        }
      });
      newTabs[index] = updatedTab;
      tabs.set(newTabs);
      goto(
        '/' +
          $tabs
            .map((tab) => toURL(tab))
            .filter((v) => v)
            .join('/')
      );
    }
  }

  function scrollIntoViewIfNecessary(ev: MouseEvent & { currentTarget: HTMLElement }) {
    if (!isElementInViewport(ev.currentTarget)) scrollTabIntoView(ev.currentTarget, false);
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
<div
  id={`wikitab-${tab.id}`}
  class="
  overflow-y-auto
  overflow-x-hidden
  mx-2 p-4 mt-2
  min-w-[395px] max-w-[395px] lg:min-w-[32rem] lg:max-w-[32rem]
  rounded-lg border border-slate-500 bg-slate-50
  h-[calc(100vh_-_32px)]"
  on:dblclick={scrollIntoViewIfNecessary}
>
  <button on:click={close}
    ><svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="w-6 h-6"
      ><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg
    ></button
  >
  <article class="font-sans mx-auto p-2 lg:max-w-4xl">
    {#if tab.type === 'article'}
      <Article {createChild} {replaceSelf} eventId={tab.data} {tab} />
    {:else if tab.type === 'new'}
      <New />
    {:else if tab.type === 'find'}
      <Search {createChild} {replaceSelf} query={tab.data} {tab} />
    {:else if tab.type === 'welcome'}
      <Welcome {createChild} />
    {:else if tab.type === 'relay'}
      <Relay {createChild} {replaceSelf} {tab} />
    {:else if tab.type === 'settings'}
      <Settings />
    {:else if tab.type === 'editor'}
      <Editor {replaceSelf} data={tab.data} />
    {/if}
  </article>
</div>
