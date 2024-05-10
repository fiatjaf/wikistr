<script lang="ts">
  import { DEFAULT_WIKI_RELAYS } from '$lib/defaults';
  import { loadRelayList } from '$lib/lists';
  import { wikiKind, account, signer, _pool } from '$lib/nostr';
  import type { ArticleCard, Card, EditorCard, EditorData } from '$lib/types.ts';
  import { getTagOr, next, normalizeArticleName, unique, urlWithoutScheme } from '$lib/utils';
  import type { EventTemplate } from 'nostr-tools';
  import { onMount } from 'svelte';

  export let replaceSelf: (card: Card) => void;
  export let card: Card;

  const editorCard = card as EditorCard;

  let data: EditorData;
  let error: string | undefined;
  let targets: { url: string; status: 'pending' | 'success' | 'failure'; message?: string }[] = [];

  onMount(() => {
    data = { ...editorCard.data };
  });

  async function publish() {
    targets = unique(
      (await loadRelayList($account!.pubkey)).filter((ri) => ri.write).map((ri) => ri.url),
      DEFAULT_WIKI_RELAYS
    ).map((url) => ({ url, status: 'pending' }));
    error = undefined;

    data.title = data.title.trim();

    let eventTemplate: EventTemplate = {
      kind: wikiKind,
      tags: [['d', normalizeArticleName(data.title)]],
      content: data.content.trim(),
      created_at: Math.round(Date.now() / 1000)
    };
    if (data.title !== eventTemplate.tags[0][1]) eventTemplate.tags.push(['title', data.title]);
    if (data.summary) eventTemplate.tags.push(['summary', data.summary]);

    try {
      let event = await signer.signEvent(eventTemplate);
      let successes: string[] = [];

      await Promise.all(
        targets.map(async (target, i) => {
          try {
            const r = await _pool.ensureRelay(target.url);
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
</script>

<div class="my-4 font-bold text-4xl">
  {#if editorCard.data.content}
    Editing an article
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
        class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ml-2"
      /></label
    >
  </div>
  <div class="mt-2">
    <label
      >Article
      <textarea
        placeholder="The **Greek alphabet** has been used to write the [[Greek language]] sincie the late 9th or early 8th century BC. The Greek alphabet is the ancestor of the [[Latin]] and [[Cyrillic]] scripts."
        bind:value={data.content}
        class="h-64 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
      /></label
    >
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
        /></label
      >
    </details>
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
  <div class="mt-2">
    <button
      on:click={publish}
      class="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >Save</button
    >
  </div>
{/if}
