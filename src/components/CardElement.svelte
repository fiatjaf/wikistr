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
  import User from '$cards/User.svelte';
  import { npubEncode } from 'nostr-tools/nip19';

  export let tab: Tab;

  function close() {
    if (tab.type === 'editor' && tab.data.previous) replaceSelf(tab.data.previous);
    else removeSelf();
  }

  function back() {
    if (tab.back) replaceSelf(tab.back);
  }

  function removeSelf() {
    const index = $tabs.findIndex((item) => item.id === tab.id);
    const newTabs = [...$tabs];
    newTabs.splice(index, 1);
    goto('/' + newTabs.map((tab) => toURL(tab)).join('/'));
  }

  function createChild(newChild: Tab) {
    newChild.parent = tab;
    const index = $tabs.findIndex((item) => item.id === tab.id);
    const newTabs = $tabs.slice(0, index + 1).concat(newChild);
    goto('/' + newTabs.map((tab) => toURL(tab)).join('/'), {
      state: [index + 1, newChild]
    });

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
      case 'user':
        return npubEncode(tab.data);
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
        <button on:click={back}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6 stroke-stone-500"
            viewBox="0 0 219.151 219.151"
          >
            <path
              d="M94.861,156.507c2.929,2.928,7.678,2.927,10.606,0c2.93-2.93,2.93-7.678-0.001-10.608l-28.82-28.819l83.457-0.008 c4.142-0.001,7.499-3.358,7.499-7.502c-0.001-4.142-3.358-7.498-7.5-7.498l-83.46,0.008l28.827-28.825 c2.929-2.929,2.929-7.679,0-10.607c-1.465-1.464-3.384-2.197-5.304-2.197c-1.919,0-3.838,0.733-5.303,2.196l-41.629,41.628 c-1.407,1.406-2.197,3.313-2.197,5.303c0.001,1.99,0.791,3.896,2.198,5.305L94.861,156.507z"
            ></path>
          </svg>
        </button>
      {/if}
      <button on:click={close}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          class="w-6 h-6 stroke-stone-800"
          viewBox="0 0 24 24"
          stroke-width="1.5"
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
      <Search {createChild} {replaceSelf} {tab} />
    {:else if tab.type === 'welcome'}
      <Welcome {createChild} />
    {:else if tab.type === 'relay'}
      <Relay {createChild} {replaceSelf} {tab} />
    {:else if tab.type === 'user'}
      <User {createChild} {tab} />
    {:else if tab.type === 'settings'}
      <Settings />
    {:else if tab.type === 'editor'}
      <Editor {replaceSelf} data={tab.data} />
    {/if}
  </article>
</div>
