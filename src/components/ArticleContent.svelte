<script lang="ts">
  import type { NostrEvent } from 'nostr-tools/pure';
  import SvelteAsciidoc from 'svelte-asciidoc';
  import WikilinkComponent from './WikilinkComponent.svelte';
  import type { Card } from '$lib/types';
  import { turnWikilinksIntoAsciidocLinks } from '$lib/utils';
  import { onMount } from 'svelte';
  import { loadWikiAuthors } from '$lib/lists';

  export let event: NostrEvent;
  export let createChild: (card: Card) => void;

  let authorPreferredWikiAuthors: string[] = [];
  const content = turnWikilinksIntoAsciidocLinks(event.content);

  onMount(() => {
    loadWikiAuthors(event.pubkey).then((ps) => {
      authorPreferredWikiAuthors = ps;
    });
  });
</script>

<SvelteAsciidoc
  supportMarkdownTransition={event.created_at < 1725137951}
  source={content}
  naturalRenderers={{ a: WikilinkComponent }}
  extra={{ createChild, preferredAuthors: [event.pubkey, ...authorPreferredWikiAuthors] }}
/>
