<script lang="ts">
  import type { NostrEvent } from 'nostr-tools';
  import SvelteMarkdown from 'svelte-markdown';
  import WikilinkComponent from './WikilinkComponent.svelte';
  import type { Tab } from '$lib/types';
  import { normalizeArticleName } from '$lib/utils';

  export let event: NostrEvent;
  export let createChild: (tab: Tab) => void;

  const content = event.content.replace(/\[\[(.*?)\]\]/g, (_: any, content: any) => {
    let [target, display] = content.split('|');
    display = display || target;
    target = normalizeArticleName(target);
    return `[${display}](wikilink:${target})`;
  });
</script>

<SvelteMarkdown source={content} renderers={{ link: WikilinkComponent }} extra={createChild} />
