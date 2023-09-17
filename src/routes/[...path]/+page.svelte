<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  import { tabs } from '$lib/state';
  import { next, scrollTabIntoView } from '$lib/utils';

  onMount(() => {
    if ($tabs.length !== 0) return;

    $tabs.push({ id: next(), type: 'welcome' });
    $page.url.pathname
      .slice(1)
      .split('/')
      .filter((str) => str !== '')
      .forEach((item: string) => {
        let ditem = decodeURIComponent(item);
        if (ditem.startsWith('wss://') || ditem.startsWith('ws://')) {
          $tabs.push({ id: next(), type: 'relay', data: ditem });
        } else if (item.match(/^[a-f0-9]{64}$/)) {
          $tabs.push({ id: next(), type: 'article', data: item });
        } else {
          $tabs.push({ id: next(), type: 'find', data: item });
        }
      });

    tabs.set($tabs);
    scrollTabIntoView($tabs[$tabs.length - 1].id, true);

    let prev = $page.params.path.split('/');
    return page.subscribe((v) => {
      let path = v.params.path.split('/');
      if (path.length < prev.length) {
        let removed = prev.find((item) => !path.includes(item));
        if (removed) {
          tabs.set($tabs.filter((tab) => tab.data !== removed));
        }
      }
      prev = path;
    });
  });
</script>
