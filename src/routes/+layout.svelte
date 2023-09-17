<script lang="ts">
  import { onMount } from 'svelte';

  import '../app.postcss';
  import { tabs } from '$lib/state';
  import { isElementInViewport, getParentCard, updateTabsOutOfView } from '$lib/utils';
  import CardElement from '$components/CardElement.svelte';

  let dragging = false;
  let startX: number;
  let scrollLeft: number;

  onMount(() => {
    const slider = document.getElementById('panel');

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

      if (ev.target instanceof HTMLElement) {
        let card = getParentCard(ev.target);
        if (card && isElementInViewport(card)) return;
      }

      ev.preventDefault();
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
      updateTabsOutOfView();
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
<div class="flex overflow-x-scroll pb-2" id="panel" draggable="false">
  {#each $tabs as tab (tab.id)}
    <CardElement {tab} />
  {/each}

  <!-- this is just empty -->
  <slot />

  <CardElement tab={{ type: 'new', id: -1 }} />
</div>
