<script lang="ts">
  export let content: string;
</script>

<button
  id={`wikilink-${content.toLocaleLowerCase().replaceAll(' ', '-')}`}
  class="text-indigo-600 underline">{content}</button
>
