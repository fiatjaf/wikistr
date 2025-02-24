<script lang="ts">
  import { onMount } from 'svelte';
  import type { NostrEvent } from 'nostr-tools/pure';
  import SvelteAsciidoc from 'svelte-asciidoc';

  import type { Card } from '$lib/types';
  import { turnWikilinksIntoAsciidocLinks, appendLinkMacroToNostrLinks } from '$lib/utils';
  import { loadWikiAuthors } from '$lib/lists';

  import CustomLinkComponent from './CustomLinkComponent.svelte';

  export let event: NostrEvent;
  export let createChild: (card: Card) => void;

  let authorPreferredWikiAuthors: string[] = [];

  const content = turnWikilinksIntoAsciidocLinks(appendLinkMacroToNostrLinks(event.content));

  onMount(() => {
    loadWikiAuthors(event.pubkey).then((ps) => {
      authorPreferredWikiAuthors = ps;
    });
  });
</script>

<SvelteAsciidoc
  supportMarkdownTransition={event.created_at < 1725137951}
  source={content}
  naturalRenderers={{ a: CustomLinkComponent }}
  customRenderers={{}}
  extra={{ createChild, preferredAuthors: [event.pubkey, ...authorPreferredWikiAuthors] }}
/>
