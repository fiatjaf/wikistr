<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Event, EventTemplate, NostrEvent } from 'nostr-tools';

  import { account, reactionKind, _pool, wikiKind, signer } from '$lib/nostr';
  import { formatDate, getA, getTagOr, next, normalizeArticleName } from '$lib/utils';
  import type { ArticleCard, SearchCard, Card } from '$lib/types';
  import { page } from '$app/stores';
  import UserLabel from '$components/UserLabel.svelte';
  import ArticleContent from '$components/ArticleContent.svelte';
  import { loadRelayList } from '$lib/lists';
  import { loadNostrUser, bareNostrUser, type NostrUser } from '$lib/metadata';
  import RelayItem from '$components/RelayItem.svelte';

  export let card: Card;
  export let createChild: (card: Card) => void;
  export let replaceSelf: (card: Card) => void;
  export let back: () => void;
  let event: Event | null = null;
  let nOthers: number | undefined = undefined;
  let copied = false;
  let likeStatus: 'liked' | 'disliked' | unknown;
  let canLike: boolean | undefined;
  let seenOn: string[] = [];
  let raw = false;

  const articleCard = card as ArticleCard;
  const dTag = articleCard.data[0];
  const pubkey = articleCard.data[1];

  let author: NostrUser = bareNostrUser(pubkey);

  $: title = event?.tags.find(([k]) => k === 'title')?.[1] || dTag;
  $: summary = event?.tags.find(([k]) => k === 'summary')?.[1];
  $: rawEvent = event ? JSON.stringify(event, null, 2) : '{...}';

  function edit() {
    replaceSelf({
      id: next(),
      type: 'editor',
      data: {
        title,
        summary,
        content: event?.content,
        previous: card
      }
    });
  }

  function shareCopy() {
    navigator.clipboard.writeText(`https://${$page.url.hostname}/${dTag}*${pubkey}`);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 2500);
  }

  function seeOthers(ev: MouseEvent) {
    if (
      articleCard.back &&
      event &&
      normalizeArticleName(articleCard.back.data) === getTagOr(event, 'd')
    ) {
      // just go back
      back();
      return;
    }

    let nextCard: SearchCard = {
      id: next(),
      type: 'find',
      data: dTag,
      preferredAuthors: [] // leave empty so we ensure the list of alternatives will be shown
    };
    if (ev.button === 1) createChild(nextCard);
    else replaceSelf(nextCard);
  }

  onMount(() => {
    // load this article
    if (articleCard.actualEvent) {
      event = articleCard.actualEvent;
      seenOn = articleCard.relayHints || [];
      return;
    }

    (async () => {
      let relays = await loadRelayList(pubkey);

      _pool.subscribeMany(
        relays
          .filter((ri) => ri.write)
          .map((ri) => ri.url)
          .concat((card as ArticleCard).relayHints),
        [
          {
            authors: [pubkey],
            '#d': [dTag],
            kinds: [wikiKind]
          }
        ],
        {
          id: 'article',
          receivedEvent(relay, _id) {
            if (seenOn.indexOf(relay.url) === -1) {
              seenOn.push(relay.url);
              seenOn = seenOn;
            }
          },
          onevent(evt) {
            if (!event || event.created_at < evt.created_at) {
              event = evt;
              setupLikes();
            }
          }
        }
      );
    })();

    (async () => {
      author = await loadNostrUser(pubkey);
    })();
  });

  onMount(() => {
    // redraw likes thing when we have a logged in user
    return account.subscribe(setupLikes);
  });

  onMount(() => {
    // help nostr stay by publishing articles from others into their write relays
    let to = setTimeout(async () => {
      if (event) {
        (await loadRelayList(event.pubkey))
          .filter((ri) => ri.write)
          .map((ri) => ri.url)
          .slice(0, 3)
          .forEach(async (url) => {
            let relay = await _pool.ensureRelay(url);
            relay.publish(event!);
          });
      }
    }, 5000);

    return () => clearTimeout(to);
  });

  onMount(() => {
    // preemptively load other versions if necessary
    if (articleCard.versions) {
      nOthers = articleCard.versions.length;
      return;
    }
  });

  let cancelers: Array<() => void> = [];
  onDestroy(() => {
    cancelers.forEach((fn) => fn());
  });

  function setupLikes() {
    if (!event) return;
    if (!$account) return;

    if ($account.pubkey === event.pubkey) {
      canLike = false;
    }

    setTimeout(() => {
      if (canLike === undefined) {
        canLike = true;
      }
    }, 2500);

    //cancelers.push(
    //  cachingSub(
    //    `reaction-${eventId.slice(-8)}`,
    //    unique($userPreferredRelays.read, safeRelays),
    //    { authors: [$account.pubkey], ['#a']: [getA(event)] },
    //    (result) => {
    //      canLike = false;

    //      switch (result[0]?.content) {
    //        case '+':
    //          liked = true;
    //          break;
    //        case '-':
    //          disliked = true;
    //          break;
    //      }
    //    }
    //  )
    //);
  }

  async function vote(v: '+' | '-') {
    if (!event) return;
    if (!canLike) return;

    let eventTemplate: EventTemplate = {
      kind: reactionKind,
      tags: [
        ['a', getA(event), seenOn[0] || ''],
        ['e', event.id, seenOn[1] || seenOn[0] || '']
      ],
      content: v,
      created_at: Math.round(Date.now() / 1000)
    };

    let inboxRelays = (await loadRelayList(pubkey)).filter((ri) => ri.read).map((ri) => ri.url);
    let relays = [...(card as ArticleCard).relayHints, ...inboxRelays, ...seenOn];

    let like: NostrEvent;
    try {
      like = await signer.signEvent(eventTemplate);
    } catch (err) {
      console.warn('failed to publish like', err);
      return;
    }

    relays.forEach(async (url) => {
      try {
        const r = await _pool.ensureRelay(url);
        await r.publish(like);
      } catch (err) {
        console.warn('failed to publish like', event, 'to', url, err);
      }
    });
  }
</script>

<div>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-missing-attribute -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  {#if event === null}
    Loading article {dTag} from {author.shortName}
  {:else}
    <div class="flex items-center">
      {#if $account}
        <div
          class="flex flex-col items-center space-y-2 mr-3"
          class:hidden={$account?.pubkey === event.pubkey}
        >
          <a
            title={canLike ? '' : likeStatus === 'like' ? 'you considered this a good article' : ''}
            class:cursor-pointer={canLike}
            on:click={() => vote('+')}
          >
            <svg
              class:fill-stone-600={canLike}
              class:fill-cyan-500={likeStatus === 'like'}
              class:hidden={likeStatus === 'disliked'}
              width="18"
              height="18"
              viewBox="0 0 18 18"><path d="M1 12h16L9 4l-8 8Z"></path></svg
            >
          </a>
          <a
            title={canLike
              ? 'this is a bad article'
              : likeStatus === 'disliked'
                ? 'you considered this a bad article'
                : ''}
            class:cursor-pointer={canLike}
            on:click={() => vote('-')}
          >
            <svg
              class:fill-stone-600={canLike}
              class:fill-rose-400={likeStatus === 'disliked'}
              class:hidden={likeStatus === 'liked'}
              width="18"
              height="18"
              viewBox="0 0 18 18"><path d="M1 6h16l-8 8-8-8Z"></path></svg
            >
          </a>
        </div>
      {/if}
      <div class="ml-2 mb-4">
        <div class="mt-2 font-bold text-4xl">{title || dTag}</div>
        <div>
          by <UserLabel pubkey={event.pubkey} {createChild} />
          {#if event.created_at}
            {formatDate(event.created_at)}
          {/if}
          <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events a11y-missing-attribute -->
        </div>
        <div>
          <a class="cursor-pointer underline" on:mouseup|preventDefault={() => (raw = !raw)}
            >{#if raw}Read{:else}Raw{/if}</a
          >
          &nbsp;• &nbsp;
          <a class="cursor-pointer underline" on:click={edit}>
            {#if event?.pubkey === $account?.pubkey}
              Edit
            {:else}
              Fork
            {/if}
          </a>
          &nbsp;• &nbsp;
          <a class="cursor-pointer underline" on:click={shareCopy}>
            {#if copied}Copied!{:else}Share{/if}
          </a>
          &nbsp;• &nbsp;
          <a class="cursor-pointer underline" on:mouseup|preventDefault={seeOthers}
            >{nOthers || ''} Versions</a
          >
        </div>
      </div>
    </div>

    <!-- Content -->
    {#if raw}
      <div class="font-mono whitespace-pre-wrap">{rawEvent}</div>
    {:else}
      <div class="prose">
        <ArticleContent {event} {createChild} />
      </div>
    {/if}

    {#if seenOn.length}
      <div class="mt-4 flex flex-wrap items-center">
        {#each seenOn as r (r)}
          <RelayItem url={r} {createChild} />
        {/each}
      </div>
    {/if}
  {/if}
</div>
