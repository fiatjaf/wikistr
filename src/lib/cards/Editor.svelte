<script lang="ts">
  import { EventBuilder, EventKind } from '@snort/system';

  import { signer, system, wikiKind } from '$lib/nostr';
  import type { EditorData } from '$lib/types.ts';

  export let data: EditorData;

  let success = 0;
  let error: string = '';

  async function publish() {
    try {
      let event = await new EventBuilder()
        .kind(wikiKind as EventKind)
        .content(data.content)
        .tag(['d', data.title.toLowerCase().replaceAll(' ', '-')])
        .tag(['title', data.title])
        .tag(['summary', data.summary])
        .buildAndSign(signer);

      system.BroadcastEvent(event);
      success = 1;
    } catch (err) {
      console.log('failed to publish event', error);
      error = String(err);
      success = -1;
    }
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
  {#if success !== 1}
    <div class="mt-2">
      <button
        on:click={publish}
        class="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >Submit</button
      >
    </div>
  {/if}

  <div>
    {#if success == -1}
      <p>
        Something went wrong :( note that NIP07 browser extentions are only supported for signing
      </p>
      <p>
        Error Message: {error}
      </p>
    {:else if success == 1}
      <p>Success!</p>
    {/if}
  </div>
</div>
