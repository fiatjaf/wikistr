<script lang="ts">
  import type { EventTemplate } from '@nostr/tools/pure';
  import SvelteAsciidoc from 'svelte-asciidoc';

  import WikilinkComponent from '$components/WikilinkComponent.svelte';
  import { DEFAULT_WIKI_RELAYS } from '$lib/defaults';
  import { wikiKind, gitPatchKind, account, signer } from '$lib/nostr';
  import type { ArticleCard, Card, EditorCard, EditorData } from '$lib/types.ts';
  import { naddrEncode } from '@nostr/tools/nip19';
  import {
    getTagOr,
    next,
    turnWikilinksIntoAsciidocLinks,
    appendLinkMacroToNostrLinks,
    unique,
    urlWithoutScheme
  } from '$lib/utils';
  import { pool } from '@nostr/gadgets/global';
  import { loadRelayList } from '@nostr/gadgets/lists';
  import { normalizeIdentifier } from '@nostr/tools/nip54';
  import debounce from 'debounce';

  interface Props {
    replaceSelf: (card: Card) => void;
    card: Card;
  }

  let { replaceSelf, card }: Props = $props();

  // svelte-ignore state_referenced_locally
  const editorCard = card as EditorCard;

  let data = $state<EditorData>({ ...editorCard.data });
  let tagsInput = $state(data.tags ? data.tags.join(', ') : '');

  function getParsedTags(): string[] {
    return tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
  }

  let error = $state<string | undefined>();
  let targets: { url: string; status: 'pending' | 'success' | 'failure'; message?: string }[] =
    $state([]);
  let previewing = $state(false);

  // Article lookup state
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let showLookup = $state(false);
  let lookupQuery = $state('');
  let lookupResults = $state<any[]>([]);
  let lookupSearching = $state(false);
  let lookupSub = $state<any>(null);

  async function performLookupSearch() {
    if (lookupSub) {
      lookupSub.close();
      lookupSub = null;
    }
    lookupResults = [];
    if (!lookupQuery.trim()) {
      lookupSearching = false;
      return;
    }
    lookupSearching = true;

    const searchRelays = unique(
      (await loadRelayList($account?.pubkey || '')).items.filter((ri) => ri.read).map((ri) => ri.url),
      DEFAULT_WIKI_RELAYS
    );

    lookupSub = pool.subscribeMany(
      searchRelays,
      [
        {
          kinds: [wikiKind],
          limit: 50
        }
      ],
      {
        onevent(evt) {
          const title = getTagOr(evt, 'title') || getTagOr(evt, 'd');
          if (
            title.toLowerCase().includes(lookupQuery.toLowerCase()) &&
            !lookupResults.some((r) => r.id === evt.id)
          ) {
            lookupResults = [...lookupResults, evt].slice(0, 10);
          }
        },
        oneose() {
          lookupSearching = false;
        }
      }
    );
  }

  const debouncedLookup = debounce(performLookupSearch, 400);

  $effect(() => {
    if (lookupQuery !== undefined) {
      debouncedLookup();
    }
  });

  function insertLink(targetTitle: string, naddr?: string) {
    if (!textareaEl) return;
    const start = textareaEl.selectionStart;
    const end = textareaEl.selectionEnd;
    const text = data.content;
    const selection = text.substring(start, end);

    let linkText = '';
    if (naddr) {
      const label = selection || targetTitle;
      linkText = `nostr:${naddr}[${label}]`;
    } else {
      if (selection) {
        linkText = `[[${targetTitle}|${selection}]]`;
      } else {
        linkText = `[[${targetTitle}]]`;
      }
    }

    data.content = text.substring(0, start) + linkText + text.substring(end);
    showLookup = false;
    lookupQuery = '';
    lookupResults = [];

    setTimeout(() => {
      textareaEl?.focus();
      const newCursorPos = start + linkText.length;
      textareaEl?.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  }

  let isSomeoneElsesArticle = $derived(
    data.previous &&
    data.previous.type === 'article' &&
    data.previous.data[1] !== $account?.pubkey
  );

  async function publish() {
    let userRelays: string[] = [];
    try {
      const rl = await loadRelayList($account!.pubkey);
      if (rl && rl.items) {
        userRelays = rl.items.filter((ri) => ri.write).map((ri) => ri.url);
      }
    } catch (e) {
      console.warn("Failed to load user's relay list", e);
    }

    targets = unique(
      userRelays,
      DEFAULT_WIKI_RELAYS
    ).map((url) => ({ url, status: 'pending' }));
    error = undefined;

    data.title = data.title.trim();

    let version = 1;
    if (data.previous && 'actualEvent' in data.previous && data.previous.actualEvent) {
      const prevEvent = data.previous.actualEvent;
      const prevVersionTag = prevEvent.tags.find(([k]) => k === 'version' || k === 'revision');
      if (prevVersionTag) {
        const parsed = parseInt(prevVersionTag[1], 10);
        if (!isNaN(parsed)) {
          version = parsed + 1;
        }
      } else {
        version = 2;
      }
    }

    let eventTemplate: EventTemplate = {
      kind: wikiKind,
      tags: [
        ['d', normalizeIdentifier(data.title)],
        ['version', String(version)]
      ],
      content: data.content.trim(),
      created_at: Math.round(Date.now() / 1000)
    };
    if (data.title !== eventTemplate.tags[0][1]) eventTemplate.tags.push(['title', data.title]);
    if (data.summary) eventTemplate.tags.push(['summary', data.summary]);
    const parsedTags = getParsedTags();
    parsedTags.forEach((tag) => {
      eventTemplate.tags.push(['t', tag]);
    });

    try {
      let event = await signer.signEvent(eventTemplate);
      let successes: string[] = [];

      await Promise.all(
        targets.map(async (target, i) => {
          try {
            const r = await pool.ensureRelay(target.url);
            await r.publish(event);
            target.status = 'success';
            successes.push(target.url);
          } catch (err) {
            target.status = 'failure';
            target.message = String(err);
          }
          targets[i] = target;
          targets = targets;
        })
      );

      if (successes.length) {
        setTimeout(() => {
          replaceSelf({
            id: next(),
            type: 'article',
            data: [getTagOr(event, 'd'), event.pubkey],
            actualEvent: event,
            relayHints: successes
          } as ArticleCard);
        }, 1400);
      }
    } catch (err) {
      error = String(err);
      targets = []; // setting this will hide the publish report dialog
      return;
    }
  }

  async function suggest() {
    if (!isSomeoneElsesArticle || !data.previous || data.previous.type !== 'article') return;
    const originalPubkey = data.previous.data[1];
    const originalDTag = data.previous.data[0];

    let userRelays: string[] = [];
    try {
      const rl = await loadRelayList($account!.pubkey);
      if (rl && rl.items) {
        userRelays = rl.items.filter((ri) => ri.write).map((ri) => ri.url);
      }
    } catch (e) {
      console.warn("Failed to load user's relay list", e);
    }

    targets = unique(
      userRelays,
      DEFAULT_WIKI_RELAYS
    ).map((url) => ({ url, status: 'pending' }));
    error = undefined;

    data.title = data.title.trim();

    let eventTemplate: EventTemplate = {
      kind: gitPatchKind,
      tags: [
        ['a', `${wikiKind}:${originalPubkey}:${originalDTag}`, (data.previous as any).relayHints?.[0] || ''],
        ['p', originalPubkey]
      ],
      content: data.content.trim(),
      created_at: Math.round(Date.now() / 1000)
    };
    if (data.title) eventTemplate.tags.push(['title', data.title]);
    if (data.summary) eventTemplate.tags.push(['summary', data.summary]);

    try {
      let event = await signer.signEvent(eventTemplate);
      let successes: string[] = [];

      await Promise.all(
        targets.map(async (target, i) => {
          try {
            const r = await pool.ensureRelay(target.url);
            await r.publish(event);
            target.status = 'success';
            successes.push(target.url);
          } catch (err) {
            target.status = 'failure';
            target.message = String(err);
          }
          targets[i] = target;
          targets = targets;
        })
      );

      if (successes.length) {
        setTimeout(() => {
          if (data.previous) {
            replaceSelf(data.previous);
          }
        }, 1400);
      }
    } catch (err) {
      error = String(err);
      targets = [];
      return;
    }
  }
</script>

<div class="my-4 font-bold text-4xl">
  {#if editorCard.data.content}
    {#if isSomeoneElsesArticle}
      Suggesting changes to article
    {:else}
      Editing an article
    {/if}
  {:else}
    Creating an article
  {/if}
</div>
{#if data}
  <div class="mt-2">
    <label class="flex items-center"
      >Title
      <input
        placeholder="example: Greek alphabet"
        bind:value={data.title}
        disabled={isSomeoneElsesArticle}
        class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ml-2 disabled:bg-gray-100 disabled:text-gray-500"
      /></label
    >
  </div>
  <div class="mt-2">
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label>
      <div class="flex justify-between items-center mt-1 mb-1">
        <span class="font-semibold text-stone-700">Article</span>
        {#if !previewing}
          <button
            type="button"
            onclick={() => showLookup = !showLookup}
            class="text-xs text-indigo-600 hover:text-indigo-800 font-semibold focus:outline-none flex items-center bg-indigo-50 px-2.5 py-1 rounded border border-indigo-150 transition-colors"
          >
            <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            Insert Link
          </button>
        {/if}
      </div>

      {#if showLookup && !previewing}
        <div class="my-2 p-3 bg-stone-50 border border-stone-200 rounded-lg shadow-inner">
          <div class="text-xs font-semibold text-stone-700 mb-1.5 flex justify-between items-center">
            <span>Search articles to reference:</span>
            <button onclick={() => { showLookup = false; lookupQuery = ''; }} class="text-[10px] text-stone-400 hover:text-stone-600">Cancel</button>
          </div>
          <div class="flex gap-2">
            <input
              bind:value={lookupQuery}
              placeholder="Type title to lookup..."
              class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-stone-300 rounded-md p-1.5"
            />
          </div>
          {#if lookupSearching}
            <div class="text-[10px] text-stone-400 mt-2 italic">Searching relays...</div>
          {/if}
          {#if lookupResults.length > 0}
            <div class="mt-2 border border-stone-200 rounded divide-y divide-stone-150 max-h-40 overflow-y-auto bg-white shadow-sm">
              {#each lookupResults as res (res.id)}
                <button
                  type="button"
                  onclick={() => {
                    const d = getTagOr(res, 'd');
                    const naddr = naddrEncode({ pubkey: res.pubkey, kind: res.kind, identifier: d });
                    insertLink(getTagOr(res, 'title') || d, naddr);
                  }}
                  class="w-full text-left p-2 hover:bg-stone-50 text-xs font-medium text-stone-700 flex justify-between items-center focus:outline-none transition-colors border-none"
                >
                  <span class="font-semibold text-indigo-700">{getTagOr(res, 'title') || getTagOr(res, 'd')}</span>
                  <span class="text-[9px] text-stone-400">by {res.pubkey.substring(0, 8)}</span>
                </button>
              {/each}
            </div>
          {:else if lookupQuery && !lookupSearching}
            <div class="text-[10px] text-stone-400 mt-2 italic">No matching pages found on relays. You can still insert this as a new wikilink:</div>
            <button
              type="button"
              onclick={() => insertLink(lookupQuery)}
              class="mt-2 px-3 py-1 bg-stone-200 hover:bg-stone-300 rounded text-[10px] font-semibold text-stone-700 transition-colors"
            >
              Insert "[[{lookupQuery}]]"
            </button>
          {/if}
        </div>
      {/if}

      {#if previewing}
        <div class="prose prose-p:my-0 prose-li:my-0">
          <SvelteAsciidoc
            source={appendLinkMacroToNostrLinks(turnWikilinksIntoAsciidocLinks(data.content))}
            naturalRenderers={{ a: WikilinkComponent as any }}
          />
        </div>
      {:else}
        <textarea
          bind:this={textareaEl}
          placeholder="The **Greek alphabet** has been used to write the [[Greek language]] sincie the late 9th or early 8th century BC. The Greek alphabet is the ancestor of the [[Latin]] and [[Cyrillic]] scripts."
          bind:value={data.content}
          class="h-64 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
        ></textarea>
      {/if}
    </label>
  </div>
  <div class="mt-2">
    <details>
      <summary>Add a summary?</summary>
      <label
        >Summary
        <textarea
          bind:value={data.summary}
          placeholder="The Greek alphabet is the earliest known alphabetic script to have distict letters for vowels. The Greek alphabet existed in many local variants."
          class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
        ></textarea></label
      >
    </details>
  </div>
  <div class="mt-4">
    <label for="categories-tags-input" class="block text-sm font-semibold text-gray-700 mb-1">
      Categories / Tags
    </label>
    <input
      id="categories-tags-input"
      type="text"
      bind:value={tagsInput}
      placeholder="e.g. science, history, philosophy (comma-separated)"
      class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
    />
  </div>
{/if}

<!-- Submit -->
{#if targets.length > 0}
  <div class="mt-2">
    Publishing to:
    {#each targets as target}
      <div class="flex items-center mt-1">
        <div
          class="p-1 rounded"
          class:bg-sky-100={target.status === 'pending'}
          class:bg-red-200={target.status === 'failure'}
          class:bg-emerald-200={target.status === 'success'}
        >
          {urlWithoutScheme(target.url)}
        </div>
        <div class="ml-1 text-xs uppercase font-mono">{target.status}</div>
        <div class="ml-1 text-sm">{target.message || ''}</div>
      </div>
    {/each}
  </div>
{:else}
  {#if error}
    <div class="mt-2 bg-red-200 px-2 py-1 rounded">
      <span class="font-bold">ERROR:</span>
      {error}
    </div>
  {/if}
  <div class="mt-2 flex justify-between items-center">
    <div class="flex space-x-2">
      {#if isSomeoneElsesArticle}
        <button
          onclick={suggest}
          class="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >Submit Change</button
        >
        <button
          onclick={publish}
          class="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >Publish Fork</button
        >
      {:else}
        <button
          onclick={publish}
          class="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >Save</button
        >
      {/if}
    </div>
    <button
      onclick={() => {
        previewing = !previewing;
      }}
      class="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
      >{#if previewing}Edit{:else}Preview{/if}</button
    >
  </div>
{/if}
