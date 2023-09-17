<script lang="ts">
  import { onMount } from 'svelte';

  import '../app.postcss';
  import { tabs, mainPanelDragging } from '$lib/state';
  import { isElementInViewport, scrollTabIntoView, getParentCard } from '$lib/utils';
  import TabElement from '$components/TabElement.svelte';
  import Searchbar from '$components/Searchbar.svelte';

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
      mainPanelDragging.set(true);
      startX = ev.clientX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    }

    function onMouseUp(ev: MouseEvent) {
      console.log('mouseup:dragging', $mainPanelDragging);
      if ($mainPanelDragging) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
      }
      mainPanelDragging.set(false);
    }

    function onMouseMove(ev: MouseEvent) {
      if (!slider) return;
      if (!$mainPanelDragging) return;
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

  <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
  <div
    id={`wikitab-special-search`}
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
