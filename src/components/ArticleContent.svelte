<script lang="ts">
  import type { NostrEvent } from '@nostr/tools/pure';
  import SvelteAsciidoc from 'svelte-asciidoc';
  import { onMount } from 'svelte';
  import { loadWikiAuthors } from '@nostr/gadgets/lists';

  import WikilinkComponent from './WikilinkComponent.svelte';
  import type { Card } from '$lib/types';
  import { turnWikilinksIntoAsciidocLinks, appendLinkMacroToNostrLinks } from '$lib/utils';

  interface Props {
    event: NostrEvent;
    createChild: (card: Card) => void;
  }

  let { event, createChild }: Props = $props();

  let authorPreferredWikiAuthors = $state<string[]>([]);
  const content = $derived(appendLinkMacroToNostrLinks(turnWikilinksIntoAsciidocLinks(event.content)));

  onMount(() => {
    loadWikiAuthors(event.pubkey).then((ps) => {
      authorPreferredWikiAuthors = ps.items;
    });
  });
</script>

<SvelteAsciidoc
  supportMarkdownTransition={event.created_at < 1725137951}
  source={content}
  naturalRenderers={{ a: WikilinkComponent as any }}
  extra={{ createChild, preferredAuthors: [event.pubkey, ...authorPreferredWikiAuthors] }}
/>
