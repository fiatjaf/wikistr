<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  import { tabs } from '$lib/state';
  import { next, scrollTabIntoView } from '$lib/utils';
  import { normalizeURL } from 'nostr-tools/utils';
  import type { Tab } from '$lib/types';

  onMount(() => {
    if ($tabs.length !== 0) return;

    $page.url.pathname
      .split('/')
      .filter((str) => str !== '')
      .forEach((pathPart: string) => {
        $tabs.push(tabFromPathPart(pathPart));
      });

    tabs.set($tabs);
    scrollTabIntoView($tabs[$tabs.length - 1].id, true);

    let prevP: string[] = [];
    return page.subscribe((v) => {
      let nextP = v.params.path.split('/');

      let nextTabs: Tab[] = [];
      for (let n = 0; n < nextP.length; n++) {
        // for all the path parts in the next url we try to find them in the previous
        let found = false;
        for (let p = 0; p < prevP.length; p++) {
          if (prevP[p] === nextP[n]) {
            // when we find something that means we will keep the corresponding tab
            // but at the new index (which is likely to be the same, but not always)
            nextTabs[n] = $tabs[p];
            found = true;

            // we also null this, so repeated pathnames cannot be re-found
            prevP[p] = '___';

            break;
          }
        }

        if (!found) {
          // when we didn't find we either
          if (v.state && (v.state as [number, Tab])[0] === n) {
            // get a tab from the routing state and assign it to this place
            // (this is preferrable as that tab in the state might contain hints that are no available in the URL)
            nextTabs[n] = (v.state as [number, Tab])[1];
          } else {
            // or create a new tab from the path and assign it to this place
            nextTabs[n] = tabFromPathPart(nextP[n]);
          }
        }
      }

      tabs.set(nextTabs);
      prevP = nextP;
    });
  });

  function tabFromPathPart(pathPart: string): Tab {
    let ditem = decodeURIComponent(pathPart);
    if ((ditem.split('.').length > 2 && ditem.startsWith('wss://')) || ditem.startsWith('ws://')) {
      return { id: next(), type: 'relay', data: normalizeURL(ditem) };
    } else if (pathPart.match(/^[\w-]+\*[a-f0-9]{64}$/)) {
      return { id: next(), type: 'article', data: pathPart.split('*') };
    } else {
      return { id: next(), type: 'find', data: pathPart };
    }
  }
</script>
