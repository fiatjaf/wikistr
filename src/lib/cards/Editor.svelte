<script lang="ts">
  import { wikiKind, broadcast, userPreferredRelays } from '$lib/nostr';
  import type { EditorData, Tab } from '$lib/types.ts';
  import { next } from '$lib/utils';
  import type { EventTemplate } from 'nostr-tools';

  export let replaceSelf: (tab: Tab) => void;
  export let data: EditorData;

  let message: string | undefined;

  async function publish() {
    let eventTemplate: EventTemplate = {
      kind: wikiKind,
      tags: [['d', data.title.toLowerCase().replaceAll(' ', '-')]],
      content: data.content,
      created_at: Math.round(Date.now() / 1000)
    };
    if (data.summary) eventTemplate.tags.push(['summary', data.summary]);

    let { event, successes, failures, error } = await broadcast(
      eventTemplate,
      $userPreferredRelays
    );
    if (successes.length === 0) {
      message = `Failed to publish: ${error}.`;
      return;
    } else if (failures.length === 0) {
      message = `Successfully published to ${successes.join(', ')}`;
    } else {
      message = `Successfully published to ${successes.join(
        ', '
      )} -- but failed to publish to ${failures.join(', ')}`;
    }

    setTimeout(() => {
      replaceSelf({ id: next(), type: 'article', data: event?.id });
    }, 1400);
  }
</script>

<div class="font-sans mx-auto p-6 lg:max-w-4xl lg:pt-6 lg:pb-28">
  <div class="prose">
    <h1>Creating an article</h1>
  </div>
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
        rows="9"
        class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
      /></label
    >
  </div>
  <div class="mt-2">
    <details>
      <summary> Add an explicit summary? </summary>
      <label
        >Summary
        <textarea
          bind:value={data.summary}
          rows="3"
          placeholder="The Greek alphabet is the earliest known alphabetic script to have distict letters for vowels. The Greek alphabet existed in many local variants."
          class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
        /></label
      >
    </details>
  </div>

  <!-- Submit -->
  {#if message}
    <div>
      <p>
        {message}
      </p>
    </div>
  {:else}
    <div class="mt-2">
      <button
        on:click={publish}
        class="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >Submit</button
      >
    </div>
  {/if}
</div>
