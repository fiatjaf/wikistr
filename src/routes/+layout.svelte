<script lang="ts">
  import { onMount } from 'svelte';

  import '../app.postcss';
  import { cards } from '$lib/state';
  import { isElementInViewport, getParentCard } from '$lib/utils';
  import CardElement from '$components/CardElement.svelte';

  let dragging = false;
  let startX: number;
  let scrollLeft: number;
  let slider: HTMLElement;

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

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="flex overflow-x-scroll pb-2" draggable="false" bind:this={slider}>
  <CardElement card={{ type: 'welcome', id: -1 }} />

  {#each $cards as card (card.id)}
    <CardElement {card} />
  {/each}

  <!-- this is just empty -->
  <slot />

  <CardElement card={{ type: 'new', id: -1 }} />
</div>
