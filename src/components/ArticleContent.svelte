<script lang="ts">
  import type { NostrEvent } from 'nostr-tools';
  import SvelteMarkdown from 'svelte-markdown';
  import WikilinkComponent from './WikilinkComponent.svelte';
  import type { Card } from '$lib/types';
  import { normalizeArticleName } from '$lib/utils';
  import { onMount } from 'svelte';
  import { loadWikiAuthors } from '$lib/lists';

  export let event: NostrEvent;
  export let createChild: (card: Card) => void;

  let authorPreferredWikiAuthors: string[] = [];

  onMount(() => {
    loadWikiAuthors(event.pubkey).then((ps) => {
      authorPreferredWikiAuthors = ps;
    });
  });

  const content = event.content.replace(/\[\[(.*?)\]\]/g, (_: any, content: any) => {
    let [target, display] = content.split('|');
    display = display || target;
    target = normalizeArticleName(target);
    return `[${display}](wikilink:${target})`;
  });
</script>

<SvelteMarkdown
  source={content}
  renderers={{ link: WikilinkComponent }}
  extra={{ createChild, preferredAuthors: [event.pubkey, ...authorPreferredWikiAuthors] }}
/>
