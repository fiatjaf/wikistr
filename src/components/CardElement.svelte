<script lang="ts">
  import { goto } from '$app/navigation';
  import { tabs } from '$lib/state';
  import type { EditorTab, Tab } from '$lib/types';
  import { scrollTabIntoView, isElementInViewport, hashbow, urlWithoutScheme } from '$lib/utils';
  import Article from '$cards/Article.svelte';
  import Editor from '$cards/Editor.svelte';
  import Welcome from '$cards/Welcome.svelte';
  import Search from '$cards/Search.svelte';
  import Settings from '$cards/Settings.svelte';
  import Relay from '$cards/Relay.svelte';
  import New from '$cards/New.svelte';

  export let tab: Tab;

  function close() {
    if (tab.type === 'editor' && tab.data.previous) replaceSelf(tab.data.previous);
    else removeSelf();
  }

  function removeSelf() {
    const index = $tabs.findIndex((item) => item.id === tab.id);
    const newTabs = [...$tabs];
    newTabs.splice(index, 1);
    goto(
      '/' +
        newTabs
          .map((tab) => toURL(tab))
          .filter((v) => v)
          .join('/')
    );
  }

  function createChild(newChild: Tab) {
    newChild.parent = tab;
    const index = $tabs.findIndex((item) => item.id === tab.id);
    const newTabs = $tabs.slice(0, index + 1).concat(newChild);
    goto(
      '/' +
        newTabs
          .map((tab) => toURL(tab))
          .filter((v) => v)
          .join('/'),
      {
        state: [index + 1, newChild]
      }
    );

    setTimeout(() => {
      if (!isElementInViewport(String(newChild.id))) {
        scrollTabIntoView(String(newChild.id), false);
      }
    }, 1);
  }

  function replaceSelf(updatedTab: Tab) {
    updatedTab.parent = tab.parent;
    const index = $tabs.findIndex((item) => item.id === tab.id);
    const newTabs = $tabs.slice();
    const removedChildren = newTabs.filter((item) => item.parent === tab);
    removedChildren.forEach((child) => {
      const childIndex = newTabs.indexOf(child);
      if (childIndex !== -1) {
        newTabs.splice(childIndex, 1);
      }
    });
    newTabs[index] = updatedTab;
    goto(
      '/' +
        newTabs
          .map((tab) => toURL(tab))
          .filter((v) => v)
          .join('/'),
      {
        state: [index, updatedTab]
      }
    );
  }

  function replaceNewTab(newTab: Tab) {
    const newTabs = $tabs.concat(newTab);
    goto(
      '/' +
        newTabs
          .map((tab) => toURL(tab))
          .filter((v) => v)
          .join('/'),
      {
        state: [$tabs.length, newTab]
      }
    );

    setTimeout(() => {
      if (!isElementInViewport(String(newTab.id))) {
        scrollTabIntoView(String(newTab.id), false);
      }
    }, 1);
  }

  function scrollIntoViewIfNecessary(ev: MouseEvent & { currentTarget: HTMLElement }) {
    if (!isElementInViewport(ev.currentTarget)) scrollTabIntoView(ev.currentTarget, false);
  }

  function toURL(tab: Tab): string | null {
    switch (tab.type) {
      case 'find':
        return tab.data;
      case 'article':
        return tab.data.join('*');
      case 'relay':
        return encodeURIComponent(urlWithoutScheme(tab.data));
      case 'editor':
        return 'edit:' + (tab as EditorTab).data.title;
    }
    return null;
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
<div
  id={`wikitab-${tab.id}`}
  class="
  overflow-y-auto
  overflow-x-hidden
  mx-2 mt-2
  min-w-[395px] max-w-[395px] lg:min-w-[32rem] lg:max-w-[32rem]
  rounded-lg border-4 border-stone-200 bg-stone-50
  h-[calc(100vh_-_32px)]
  p-4"
  on:dblclick={scrollIntoViewIfNecessary}
  style:background-color={tab.type === 'article'
    ? hashbow(tab.data[0], 94)
    : tab.type === 'find'
      ? hashbow(tab.data, 88)
      : ''}
>
  {#if tab.type !== 'welcome' && tab.type !== 'new'}
    <div class="flex" class:justify-between={tab.back} class:justify-end={!tab.back}>
      {#if tab.back}
        <button on:click={close}>
          <svg
            fill="#000000"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            viewBox="0 0 60.731 60.73"
            xml:space="preserve"
            ><g stroke-linecap="round" stroke-linejoin="round"></g><g>
              <polygon
                points="0,30.365 29.737,60.105 29.737,42.733 60.731,42.729 60.731,18.001 29.737,17.999 29.737,0.625 "
              ></polygon>
            </g></svg
          >
        </button>
      {/if}
      <button on:click={close}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-6 h-6"
          ><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg
        >
      </button>
    </div>
  {/if}
  <article class="font-sans mx-auto p-2 lg:max-w-4xl">
    {#if tab.type === 'article'}
      <Article {createChild} {replaceSelf} article={tab.data} {tab} />
    {:else if tab.type === 'new'}
      <New {replaceNewTab} />
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
