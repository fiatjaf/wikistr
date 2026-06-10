<script lang="ts">
  import { onMount } from 'svelte';

  import '../app.postcss';
  import { cards } from '$lib/state';
  import { isElementInViewport, getParentCard } from '$lib/utils';
  import CardElement from '$components/CardElement.svelte';
  interface Props {
    children?: import('svelte').Snippet;
  }

  let { children }: Props = $props();

  let dragging = false;
  let startX: number;
  let scrollLeft: number;
  let slider: HTMLElement;

  let isWelcomeCollapsed = $state(false);
  let isRecentCollapsed = $state(false);
  let prevCardsLength = 0;

  $effect(() => {
    if ($cards.length < 1) {
      isWelcomeCollapsed = false;
      isRecentCollapsed = false;
    } else if ($cards.length >= 1 && prevCardsLength < 1) {
      isWelcomeCollapsed = true; // Auto-collapse when first column is opened
      isRecentCollapsed = true;
    }
    prevCardsLength = $cards.length;
  });

  onMount(() => {
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
    };

    function onMouseDown(ev: MouseEvent) {
      if (!slider) return;

      let path = ev.composedPath();
      if (path[0] !== slider) {
        return;
      }

      if (ev.target instanceof HTMLElement) {
        let card = getParentCard(ev.target);
        if (card && isElementInViewport(card)) return;
      }

      dragging = true;
      startX = ev.clientX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    }

    function onMouseUp(ev: MouseEvent) {
      if (dragging) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
      }
      dragging = false;
    }

    function onMouseMove(ev: MouseEvent) {
      if (!slider) return;
      if (!dragging) return;
      ev.preventDefault();
      slider.scrollLeft = scrollLeft + startX - ev.clientX;
    }
  });
</script>

<svelte:head>
  <title>wikistr</title>
</svelte:head>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="flex flex-col sm:flex-row sm:overflow-x-scroll pb-2" draggable="false" bind:this={slider}>
  <CardElement 
    card={{ type: 'welcome', id: -1 }} 
    collapsed={$cards.length >= 1 && isWelcomeCollapsed}
    onToggleCollapse={() => isWelcomeCollapsed = !isWelcomeCollapsed}
  />

  <CardElement 
    card={{ type: 'recent', id: -2 }} 
    collapsed={$cards.length >= 1 && isRecentCollapsed}
    onToggleCollapse={() => isRecentCollapsed = !isRecentCollapsed}
  />

  {#each $cards as card (card.id)}
    <CardElement {card} />
  {/each}

  <!-- this is just empty -->
  {@render children?.()}
</div>
