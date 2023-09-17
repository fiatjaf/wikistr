<script lang="ts">
  import { onMount } from 'svelte';

  import '../app.postcss';
  import { tabs } from '$lib/state';
  import { isElementInViewport, getParentCard } from '$lib/utils';
  import TabElement from '$components/TabElement.svelte';

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
    <TabElement {tab} />
  {/each}

  <!-- this is just empty -->
  <slot />

  <TabElement tab={{ type: 'new', id: -1 }} />
</div>
