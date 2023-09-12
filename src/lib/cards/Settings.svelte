<script lang="ts">
  function saveData() {}
</script>

<div class="mx-4 mt-4 w-5/6">
  <div class="mb-6">
    <div class="prose">
      <h1 class="mt-0">Settings</h1>
    </div>
  </div>

  <!-- Save button -->
  <button
    on:click={saveData}
    type="button"
    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
  >
    Save & Reload
  </button>
</div>
