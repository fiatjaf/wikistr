<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import debounce from 'debounce';
  import type { NostrEvent, Event } from '@nostr/tools/pure';
  import type { AbstractRelay } from '@nostr/tools/abstract-relay';
  import type { SubCloser } from '@nostr/tools/abstract-pool';
  import { pool } from '@nostr/gadgets/global';
  import { loadRelayList } from '@nostr/gadgets/lists';
  import { normalizeIdentifier } from '@nostr/tools/nip54';

  import { wot, wikiKind, reactionKind, userWikiRelays } from '$lib/nostr';
  import type { ArticleCard, SearchCard, Card } from '$lib/types';
  import { addUniqueTaggedReplaceable, getTagOr, next, unique } from '$lib/utils';
  import { DEFAULT_SEARCH_RELAYS } from '$lib/defaults';
  import ArticleListItem from '$components/ArticleListItem.svelte';
  import { replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { cards } from '$lib/state';

  interface Props {
    card: Card;
    replaceSelf: (card: Card) => void;
    createChild: (card: Card) => void;
  }

  let { card, replaceSelf, createChild }: Props = $props();
  let tried = $state(false);
  let eosed = $state(0);
  let editable = $state(false);

  let searchCard = $derived(card as SearchCard);

  // svelte-ignore state_referenced_locally
  let query = $state((card as SearchCard).data);
  let seenCache: { [id: string]: string[] } = {};
  let results = $state<NostrEvent[]>([]);
  let searchReactions = $state<{ [aCoordinate: string]: NostrEvent[] }>({});

  // close handlers
  let uwrcancel: () => void;
  let search: SubCloser;
  let reactionSub: SubCloser | null = null;
  let subs: SubCloser[] = [];
  let redirectTimeout: ReturnType<typeof setTimeout> | undefined;
  let redirected = false;

  onMount(() => {
    // we won't do any searches if we already have the results
    if (searchCard.results) {
      seenCache = searchCard.seenCache || {};
      results = searchCard.results || [];

      tried = true;
      return;
    }

    performSearch();
  });

  onDestroy(destroy);

  function destroy() {
    if (uwrcancel) uwrcancel();
    subs.forEach((sub) => sub.close());
    if (search) search.close();
    if (reactionSub) {
      reactionSub.close();
      reactionSub = null;
    }
    if (redirectTimeout) {
      clearTimeout(redirectTimeout);
      redirectTimeout = undefined;
    }
  }

  async function performSearch() {
    // cancel existing subscriptions and zero variables
    destroy();
    tried = false;
    eosed = 0;
    results = [];
    redirected = false;

    const isTagQuery = query.startsWith('#');
    const tagTerm = isTagQuery ? query.substring(1).toLowerCase().trim() : '';

    setTimeout(() => {
      tried = true;
    }, 1500);

    function getAuthoritativeScore(evt: NostrEvent): number {
      const authorWoT = $wot[evt.pubkey] || 0;
      const aCoordinate = `${wikiKind}:${evt.pubkey}:${getTagOr(evt, 'd')}`;
      const reactions = searchReactions[aCoordinate] || [];
      
      const reactionsScore = reactions.reduce((sum, r) => {
        const reactorWoT = $wot[r.pubkey] || 0;
        return sum + 1 + reactorWoT;
      }, 0);
      
      return authorWoT + reactionsScore;
    }

    const update = debounce(() => {
      // sort by exact matches first, then by authoritative score (WoT + reactions)
      let normalizedIdentifier = normalizeIdentifier(query);
      results = [...results].sort((a, b) => {
        if (
          !isTagQuery &&
          getTagOr(a, 'd') === normalizedIdentifier &&
          getTagOr(b, 'd') !== normalizedIdentifier
        ) {
          return -1;
        } else if (
          !isTagQuery &&
          getTagOr(b, 'd') === normalizedIdentifier &&
          getTagOr(a, 'd') !== normalizedIdentifier
        ) {
          return 1;
        } else {
          return getAuthoritativeScore(b) - getAuthoritativeScore(a);
        }
      });
      seenCache = seenCache;

      // Subscribe to reactions for all current results
      if (reactionSub) {
        reactionSub.close();
      }
      if (results.length > 0) {
        const coordinates = results.map(r => `${wikiKind}:${r.pubkey}:${getTagOr(r, 'd')}`);
        const queryRelays = unique($userWikiRelays, DEFAULT_SEARCH_RELAYS);
        reactionSub = pool.subscribeMany(
          queryRelays,
          [
            {
              kinds: [reactionKind],
              '#a': coordinates
            }
          ],
          {
            id: 'search-reactions-' + query,
            onevent(evt) {
              const targetA = evt.tags.find(([k]) => k === 'a')?.[1];
              if (targetA && evt.content === '✅') {
                const current = searchReactions[targetA] || [];
                if (!current.some(r => r.id === evt.id)) {
                  searchReactions = {
                    ...searchReactions,
                    [targetA]: [...current, evt]
                  };
                  // Re-sort results inline
                  results = [...results].sort((a, b) => {
                    if (
                      !isTagQuery &&
                      getTagOr(a, 'd') === normalizedIdentifier &&
                      getTagOr(b, 'd') !== normalizedIdentifier
                    ) {
                      return -1;
                    } else if (
                      !isTagQuery &&
                      getTagOr(b, 'd') === normalizedIdentifier &&
                      getTagOr(a, 'd') !== normalizedIdentifier
                    ) {
                      return 1;
                    } else {
                      return getAuthoritativeScore(b) - getAuthoritativeScore(a);
                    }
                  });
                }
              }
            }
          }
        );
      }
    }, 500);

    const relaysFromPreferredAuthors = unique(
      (await Promise.all((searchCard.preferredAuthors || []).map((pk) => loadRelayList(pk))))
        .map((rl) => rl.items)
        .flat()
        .filter((ri) => ri.write)
        .map((ri) => ri.url)
    );

    let previouslyQueriedRelays: string[] = [];
    uwrcancel = userWikiRelays.subscribe(async (uwr) => {
      const relaysToUseNow = [];

      for (let i = 0; i < uwr.length; i++) {
        let r = uwr[i];
        if (previouslyQueriedRelays.indexOf(r) === -1) {
          relaysToUseNow.push(r);
          previouslyQueriedRelays.push(r);
        }
      }

      for (let i = 0; i < relaysFromPreferredAuthors.length; i++) {
        let r = relaysFromPreferredAuthors[i];
        if (previouslyQueriedRelays.indexOf(r) === -1) {
          relaysToUseNow.push(r);
          previouslyQueriedRelays.push(r);
        }
      }

      if (relaysToUseNow.length === 0) return;

      const exactFilter = isTagQuery
        ? { kinds: [wikiKind], '#t': [tagTerm], limit: 25 }
        : { kinds: [wikiKind], '#d': [normalizeIdentifier(query)], limit: 25 };

      let subc = pool.subscribeMany(
        relaysToUseNow,
        [exactFilter],
        {
          id: 'find-exactmatch',
          onevent(evt) {
            tried = true;

            const shouldRedirect = searchCard.redirect !== false;

            if (shouldRedirect && !isTagQuery && searchCard.preferredAuthors.includes(evt.pubkey)) {
              // we found an exact match that fits the list of preferred authors
              // jump straight into it
              redirected = true;
              if (redirectTimeout) clearTimeout(redirectTimeout);
              openArticle(evt, undefined, true);
            }

            if (addUniqueTaggedReplaceable(results, evt)) {
              update();

              // If we have not redirected yet, check if this is an exact match and schedule a fallback redirect
              if (shouldRedirect && !isTagQuery && !redirected && getTagOr(evt, 'd') === normalizeIdentifier(query)) {
                if (!redirectTimeout) {
                  redirectTimeout = setTimeout(() => {
                    if (redirected) return;
                    // Find the best exact match from results (sorted by WoT)
                    const exactMatches = results.filter(
                      (r) => getTagOr(r, 'd') === normalizeIdentifier(query)
                    );
                    if (exactMatches.length > 0) {
                      redirected = true;
                      openArticle(exactMatches[0], undefined, true);
                    }
                  }, 800);
                }
              }
            }
          },
          oneose,
          receivedEvent
        }
      );

      subs.push(subc);
    });

    search = pool.subscribeMany(
      DEFAULT_SEARCH_RELAYS,
      [{ kinds: [wikiKind], search: query, limit: 10 }],
      {
        id: 'find-search',
        onevent(evt) {
          if (addUniqueTaggedReplaceable(results, evt)) update();
        },
        oneose,
        receivedEvent
      }
    );

    function oneose() {
      eosed++;
      if (eosed === 2) {
        tried = true;
        searchCard.results = results;
        searchCard.seenCache = seenCache;
      }
    }

    function receivedEvent(relay: any, id: string) {
      if (!(id in seenCache)) seenCache[id] = [];
      if (seenCache[id].indexOf(relay.url) === -1) seenCache[id].push(relay.url);
    }
  }

  const debouncedPerformSearch = debounce(performSearch, 400);

  function openArticle(result: Event, ev?: MouseEvent, direct?: boolean) {
    try {
      let articleCard: ArticleCard = {
        id: next(),
        type: 'article',
        data: [getTagOr(result, 'd'), result.pubkey],
        relayHints: seenCache[result.id],
        actualEvent: { ...result, tags: result.tags.map(t => [...t]) },
        versions:
          getTagOr(result, 'd') === normalizeIdentifier(query)
            ? results
                .filter((evt) => getTagOr(evt, 'd') === normalizeIdentifier(query))
                .map((evt) => ({ ...evt, tags: evt.tags.map((t) => [...t]) }))
            : undefined
      };
      if (ev?.button === 1) createChild(articleCard);
      else if (direct)
        // if this is called with 'direct' we won't give it a back button
        replaceSelf(articleCard);
      else replaceSelf({ ...articleCard, back: card }); // otherwise we will
    } catch (err) {
      alert("Error in openArticle: " + err);
    }
  }

  function startEditing() {
    debouncedPerformSearch.clear();
    editable = true;
  }

  function preventKeys(ev: KeyboardEvent) {
    if (ev.key === 'Enter' || ev.key === 'Tab') {
      ev.preventDefault();
      (ev.currentTarget as any)?.blur();
      finishedEditing();
    }
  }

  function finishedEditing() {
    if (!editable) return;

    editable = false;
    query = query.replace(/[\r\n]/g, '').replace(/[^\w .:-]/g, '-');
    if (query !== searchCard.data) {
      // replace browser url and history
      let index = $cards.findIndex((t) => t.id === card.id);
      let replacementURL = page.url.pathname.split('/').slice(1);
      replacementURL[index] = query;

      let currentState = page.state as [number, Card];
      replaceState('/' + replacementURL.join('/'), currentState[0] === index ? [] : currentState);

      // update stored card state
      searchCard.data = normalizeIdentifier(query);
      searchCard.results = undefined;
      searchCard.redirect = false;

      // redo the query
      debouncedPerformSearch();
    }
  }
</script>

<div class="mt-2 font-bold text-4xl">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <span
    ondblclick={startEditing}
    onblur={finishedEditing}
    onkeydown={preventKeys}
    contenteditable="plaintext-only"
    bind:textContent={query}
  ></span>"
</div>
{#each results as result (result.id)}
  <ArticleListItem event={result} {openArticle} />
{/each}
{#if tried}
  <div class="px-4 py-4 bg-white border-2 border-stone rounded-lg mt-4">
    <p class="mb-2 mt-0">
      {results.length < 1 ? "Can't find this article." : "Didn't find what you were looking for?"}
    </p>
    <button
      onclick={() => {
        replaceSelf({ id: next(), type: 'editor', data: { title: query, summary: '', content: '', previous: card } });
      }}
      class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      Create this article!
    </button>
    <button
      onclick={() => createChild({ id: next(), type: 'settings' })}
      class="ml-1 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      Add more relays
    </button>
  </div>
{:else}
  <div class="px-4 py-5 rounded-lg mt-2">Loading...</div>
{/if}
