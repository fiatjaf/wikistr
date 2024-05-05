<script lang="ts">
  import { onMount } from 'svelte';
  import type { Event, EventTemplate } from 'nostr-tools';

  import {
    account,
    userPreferredRelays,
    getRelaysForEvent,
    reactionKind,
    broadcast,
    _pool
  } from '$lib/nostr';
  import { formatDate, getA, next } from '$lib/utils';
  import type { RelayTab, SearchTab, Tab } from '$lib/types';
  import { page } from '$app/stores';
  import UserLabel from '$components/UserLabel.svelte';
  import ArticleContent from '$components/ArticleContent.svelte';
  import { loadRelayList } from '$lib/lists';
  import { loadNostrUser, bareNostrUser, type NostrUser } from '$lib/metadata';

  export let article: [string, string];
  export let tab: Tab;
  export let createChild: (tab: Tab) => void;
  export let replaceSelf: (tab: Tab) => void;
  let event: Event | null = null;
  let copied = false;
  let liked = false;
  let disliked = false;
  let canLike: boolean | undefined;
  const dTag = article[0];
  const pubkey = article[1];
  let author: NostrUser = bareNostrUser(pubkey);

  $: title = event?.tags.find(([k]) => k === 'title')?.[1] || dTag;
  $: summary = event?.tags.find(([k]) => k === 'summary')?.[1];
  $: relaysForEvent = event ? getRelaysForEvent(event) : [];

  function edit() {
    replaceSelf({
      id: next(),
      type: 'editor',
      data: {
        title,
        summary,
        content: event?.content,
        previous: tab
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
    let nextTab: SearchTab = {
      id: next(),
      type: 'find',
      data: dTag
    };
    if (ev.button === 1) createChild(nextTab);
    else replaceSelf(nextTab);
  }

  function openRelay(relay: string) {
    let relayTab: RelayTab = { id: next(), type: 'relay', data: relay };
    createChild(relayTab);
  }

  onMount(() => {
    (async () => {
      let relays = await loadRelayList(pubkey);

      _pool.subscribeMany(
        relays.filter((ri) => ri.write).map((ri) => ri.url),
        [
          {
            authors: [pubkey],
            '#d': [dTag]
          }
        ],
        {
          onevent(evt) {
            if (!event || event.created_at < evt.created_at) {
              event = evt;
              onArticle();
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
    return account.subscribe(onArticle);
  });

  let cancelers: Array<() => void> = [];
  onMount(() => {
    return () => {
      cancelers.forEach((fn) => fn());
    };
  });

  function onArticle() {
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
    //    [...$userPreferredRelays.read, ...safeRelays],
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

  function vote(v: '+' | '-') {
    if (!event) return;
    if (!canLike) return;

    let relays = Array.from(getRelaysForEvent(event));
    let eventTemplate: EventTemplate = {
      kind: reactionKind,
      tags: [
        ['a', getA(event), relays[0] || ''],
        ['e', event.id, relays[1] || relays[0] || '']
      ],
      content: v,
      created_at: Math.round(Date.now() / 1000)
    };

    broadcast(eventTemplate, $userPreferredRelays.write);
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
      <div
        class="flex flex-col items-center space-y-2 mr-3"
        class:hidden={$account?.pubkey === event.pubkey}
      >
        <a
          title={canLike ? '' : liked ? 'you considered this a good article' : ''}
          class:cursor-pointer={canLike}
          on:click={() => vote('+')}
        >
          <svg
            class:fill-stone-600={canLike}
            class:fill-cyan-500={liked}
            class:hidden={disliked}
            width="18"
            height="18"
            viewBox="0 0 18 18"><path d="M1 12h16L9 4l-8 8Z"></path></svg
          >
        </a>
        <a
          title={canLike
            ? 'this is a bad article'
            : disliked
              ? 'you considered this a bad article'
              : ''}
          class:cursor-pointer={canLike}
          on:click={() => vote('-')}
        >
          <svg
            class:fill-stone-600={canLike}
            class:fill-rose-400={disliked}
            class:hidden={liked}
            width="18"
            height="18"
            viewBox="0 0 18 18"><path d="M1 6h16l-8 8-8-8Z"></path></svg
          >
        </a>
      </div>
      <div class="ml-2 mb-4">
        <div class="mt-2 font-bold text-4xl">{title || dTag}</div>
        <div>
          by <UserLabel pubkey={event.pubkey} />
          {#if event.created_at}
            on {formatDate(event.created_at)}
          {/if}
          <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events a11y-missing-attribute -->
        </div>
        <div>
          <a class="cursor-pointer underline" on:click={edit}>Fork</a>
          &nbsp;• &nbsp;
          <a class="cursor-pointer underline" on:click={shareCopy}>
            {#if copied}Copied!{:else}Share{/if}
          </a>
          &nbsp;• &nbsp;
          <a class="cursor-pointer underline" on:mouseup|preventDefault={seeOthers}>Versions</a>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="prose">
      <ArticleContent {event} {createChild} />
    </div>

    {#if relaysForEvent.length}
      <div class="mt-4">
        <div class="font-bold text-lg">Found on relays</div>
        <ul class="list-disc m-0 pt-2 px-5">
          {#each relaysForEvent as r}
            <li class="p-0 m-0">
              <a
                class="cursor-pointer underline"
                on:mouseup|preventDefault={openRelay.bind(null, r)}
              >
                {new URL(r).host}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  {/if}
</div>
