<script lang="ts">
  import { goto } from '$app/navigation';
  import { cards } from '$lib/state';
  import type { EditorCard, Card } from '$lib/types';
  import { scrollCardIntoView, isElementInViewport, hashbow, urlWithoutScheme } from '$lib/utils';
  import Article from '$cards/Article.svelte';
  import Editor from '$cards/Editor.svelte';
  import Welcome from '$cards/Welcome.svelte';
  import Search from '$cards/Search.svelte';
  import Settings from '$cards/Settings.svelte';
  import Relay from '$cards/Relay.svelte';
  import New from '$cards/New.svelte';
  import User from '$cards/User.svelte';
  import { npubEncode } from 'nostr-tools/nip19';

  export let card: Card;

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
      state: [index + 1, newChild]
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
        state: [index, updatedCard]
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
        state: [$cards.length, newCard]
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
        return card.data;
      case 'article':
        return card.data.join('*');
      case 'relay':
        return encodeURIComponent(urlWithoutScheme(card.data));
      case 'user':
        return npubEncode(card.data);
      case 'editor':
        return 'edit:' + (card as EditorCard).data.title;
    }
    return null;
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
<div
  id={`wikicard-${card.id}`}
  class="
  overflow-y-auto
  overflow-x-hidden
  mx-2 mt-2
  min-w-[395px] max-w-[395px] lg:min-w-[32rem] lg:max-w-[32rem]
  rounded-lg border-4 border-stone-200 bg-stone-50
  h-[calc(100vh_-_32px)]
  p-4"
  on:dblclick={scrollIntoViewIfNecessary}
  style:background-color={card.type === 'article'
    ? hashbow(card.data[0], 94)
    : card.type === 'find'
      ? hashbow(card.data, 88)
      : ''}
>
  {#if card.type !== 'welcome' && card.type !== 'new'}
    <div class="flex" class:justify-between={card.back} class:justify-end={!card.back}>
      {#if card.back}
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
    {#if card.type === 'article'}
      <Article {createChild} {replaceSelf} {back} {card} />
    {:else if card.type === 'new'}
      <New {replaceNewCard} />
    {:else if card.type === 'find'}
      <Search {createChild} {replaceSelf} {card} />
    {:else if card.type === 'welcome'}
      <Welcome {createChild} />
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
</div>
