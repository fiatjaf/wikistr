<script lang="ts">
  import { npubEncode } from '@nostr/tools/nip19';

  import { goto } from '$app/navigation';
  import { cards } from '$lib/state';
  import { type EditorCard, type Card, serializeCardForRouter } from '$lib/types';
  import { scrollCardIntoView, isElementInViewport, hashbow, urlWithoutScheme } from '$lib/utils';
  import Article from '$cards/Article.svelte';
  import Editor from '$cards/Editor.svelte';
  import Welcome from '$cards/Welcome.svelte';
  import Recent from '$cards/Recent.svelte';
  import Search from '$cards/Search.svelte';
  import Settings from '$cards/Settings.svelte';
  import Relay from '$cards/Relay.svelte';
  import New from '$cards/New.svelte';
  import User from '$cards/User.svelte';

  interface Props {
    card: Card;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
  }

  let { card, collapsed = false, onToggleCollapse }: Props = $props();

  function close() {
    if (card.type === 'editor' && card.data.previous) replaceSelf(card.data.previous);
    else removeSelf();
  }

  function back() {
    if (card.back) replaceSelf(card.back);
  }

  function removeSelf() {
    const index = $cards.findIndex((item) => item.id === card.id);
    const newCards = [...$cards];
    newCards.splice(index, 1);
    goto('/' + newCards.map((card) => toURL(card)).join('/'));
  }

  function createChild(newChild: Card) {
    const index = $cards.findIndex((item) => item.id === card.id);
    const newCards = $cards
      .slice(0, index + 1)
      .concat(newChild)
      .concat($cards.slice(index + 1));
    goto('/' + newCards.map((card) => toURL(card)).join('/'), {
      state: [index + 1, serializeCardForRouter(newChild)]
    });

    setTimeout(() => {
      if (!isElementInViewport(String(newChild.id))) {
        scrollCardIntoView(String(newChild.id), false);
      }
    }, 1);
  }

  function replaceSelf(updatedCard: Card) {
    const index = $cards.findIndex((item) => item.id === card.id);
    const newCards = $cards.slice();
    newCards[index] = updatedCard;
    goto(
      '/' +
        newCards
          .map((card) => toURL(card))
          .filter((v) => v)
          .join('/'),
      {
        state: [index, serializeCardForRouter(updatedCard)]
      }
    );
  }

  function replaceNewCard(newCard: Card) {
    const newCards = $cards.concat(newCard);
    goto(
      '/' +
        newCards
          .map((card) => toURL(card))
          .filter((v) => v)
          .join('/'),
      {
        state: [$cards.length, serializeCardForRouter(newCard)]
      }
    );

    setTimeout(() => {
      if (!isElementInViewport(String(newCard.id))) {
        scrollCardIntoView(String(newCard.id), false);
      }
    }, 1);
  }

  function scrollIntoViewIfNecessary(ev: MouseEvent & { currentTarget: HTMLElement }) {
    if (!isElementInViewport(ev.currentTarget)) scrollCardIntoView(ev.currentTarget, false);
  }

  function toURL(card: Card): string | null {
    switch (card.type) {
      case 'find':
        return encodeURIComponent(encodeURIComponent(card.data));
      case 'article':
        return card.data.join('*');
      case 'relay':
        return encodeURIComponent(urlWithoutScheme(card.data));
      case 'user':
        return npubEncode(card.data);
      case 'editor':
        return 'edit:' + (card as EditorCard).data.title;
      case 'settings':
        return 'settings';
    }
    return null;
  }
</script>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  role="presentation"
  id={`wikicard-${card.id}`}
  class="
  overflow-y-auto
  overflow-x-hidden
  mx-2 mt-2
  w-[calc(100vw_-_24px)] min-w-[calc(100vw_-_24px)] max-w-[calc(100vw_-_24px)]
  {collapsed 
    ? 'sm:min-w-[64px] sm:max-w-[64px] sm:overflow-hidden' 
    : card.type === 'article' || card.type === 'editor'
      ? 'sm:min-w-[500px] sm:max-w-[500px] lg:min-w-[48rem] lg:max-w-[48rem] xl:min-w-[56rem] xl:max-w-[56rem]' 
      : 'sm:min-w-[395px] sm:max-w-[395px] lg:min-w-[32rem] lg:max-w-[32rem]'}
  rounded-lg border-8 bg-white
  {collapsed ? 'sm:h-[calc(100vh_-_32px)] h-auto sm:p-2 p-4' : 'h-[calc(100vh_-_32px)] p-4'}
  transition-all duration-300
  scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-stone-100 hover:scrollbar-thumb-stone-400"
  ondblclick={scrollIntoViewIfNecessary}
  style:border-color={card.type === 'article'
    ? hashbow(card.data[0], 84)
    : card.type === 'find'
      ? hashbow(card.data, 88)
      : '#e5e7eb'}
>
  {#if collapsed}
    <!-- Collapsed vertical view on desktop -->
    <div class="hidden sm:flex flex-col items-center justify-start h-full pt-2 space-y-8 select-none">
      <button 
        onclick={onToggleCollapse}
        class="p-1.5 rounded-md hover:bg-stone-100 text-stone-600 transition-colors"
        title={card.type === 'welcome' ? 'Expand welcome column' : 'Expand recent articles column'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5M4.5 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
      <div class="text-stone-400 font-bold tracking-widest text-xs uppercase whitespace-nowrap rotate-180" style="writing-mode: vertical-lr;">
        {#if card.type === 'welcome'}
          Welcome & Search
        {:else if card.type === 'recent'}
          Recent Articles
        {/if}
      </div>
    </div>
    <!-- Mobile view fallback -->
    <div class="sm:hidden flex justify-between items-center">
      <div class="font-bold text-lg text-stone-700">
        {#if card.type === 'welcome'}
          Welcome & Search
        {:else if card.type === 'recent'}
          Recent Articles
        {/if}
      </div>
      <button 
        onclick={onToggleCollapse} 
        class="p-1.5 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded transition-colors"
        title={card.type === 'welcome' ? 'Expand welcome column' : 'Expand recent articles column'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>
  {:else}
    {#if (card.type === 'welcome' || card.type === 'recent') && onToggleCollapse}
      <!-- Desktop collapse button -->
      <div class="hidden sm:flex justify-end mb-2">
        <button 
          onclick={onToggleCollapse}
          class="p-1 rounded-md hover:bg-stone-100 text-stone-500 transition-colors"
          title={card.type === 'welcome' ? 'Collapse welcome column' : 'Collapse recent articles column'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5M12 19.5l-7.5-7.5 7.5-7.5" />
          </svg>
        </button>
      </div>
      <!-- Mobile collapse header -->
      <div class="sm:hidden flex justify-between items-center mb-4 pb-2 border-b border-stone-100">
        <div class="font-bold text-lg text-stone-700">
          {#if card.type === 'welcome'}
            Welcome & Search
          {:else if card.type === 'recent'}
            Recent Articles
          {/if}
        </div>
        <button 
          onclick={onToggleCollapse} 
          class="p-1.5 text-stone-600 hover:bg-stone-50 border border-stone-200 rounded transition-colors"
          title={card.type === 'welcome' ? 'Collapse welcome column' : 'Collapse recent articles column'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      </div>
    {/if}

    {#if card.type !== 'welcome' && card.type !== 'new' && card.type !== 'recent'}
      <div class="flex" class:justify-between={card.back} class:justify-end={!card.back}>
        {#if card.back}
          <button aria-label="back" onclick={back}>
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
        <button aria-label="close" onclick={close}>
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
      {#if card.type === 'article'}
        <Article {createChild} {replaceSelf} {back} {card} />
      {:else if card.type === 'new'}
        <New {replaceNewCard} />
      {:else if card.type === 'find'}
        <Search {createChild} {replaceSelf} {card} />
      {:else if card.type === 'welcome'}
        <Welcome {createChild} />
      {:else if card.type === 'recent'}
        <Recent {createChild} />
      {:else if card.type === 'relay'}
        <Relay {createChild} {replaceSelf} {card} />
      {:else if card.type === 'user'}
        <User {createChild} {card} />
      {:else if card.type === 'settings'}
        <Settings />
      {:else if card.type === 'editor'}
        <Editor {replaceSelf} {card} />
      {/if}
    </article>
  {/if}
</div>
