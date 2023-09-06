<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  import { tabs } from '$lib/state';
  import { next } from '$lib/utils';

  onMount(() => {
    if ($tabs.length !== 0) return;

    if ($page.params.path.length === 0) {
      $tabs.push({ id: next(), type: 'welcome' });
    } else {
      $page.params.path.split('/').forEach((item: string) => {
        if (item.match(/^[a-f0-9]{64}$/)) {
          $tabs.push({ id: next(), type: 'article', data: item });
        } else {
          $tabs.push({ id: next(), type: 'articlefind', data: item });
        }
      });
    }

    tabs.set($tabs);
  });
</script>
