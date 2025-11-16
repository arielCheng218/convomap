<script>
  import Graph from './Graph.svelte';
  import Map from './Map.svelte';

  export let showTranscript = false;

  let activeTab = 'graph';
</script>

<div class="header">
  <div class="tabs">
    <button
      class:active={activeTab === 'graph'}
      on:click={() => activeTab = 'graph'}
    >
      Graph
    </button>
    <button
      class:active={activeTab === 'map'}
      on:click={() => activeTab = 'map'}
    >
      Map
    </button>
  </div>
  <button class="transcript-toggle" on:click={() => showTranscript = true}>
    Open Transcript
  </button>
</div>

<div class="tab-content">
  {#if activeTab === 'graph'}
    <Graph />
  {:else if activeTab === 'map'}
    <Map />
  {/if}
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #e0e0e0;
    margin-bottom: 20px;
  }

  .tabs {
    display: flex;
    gap: 0;
  }

  .tabs button {
    padding: 10px 20px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 16px;
    color: #666;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: all 0.2s;
  }

  .tabs button:hover {
    color: #333;
  }

  .tabs button.active {
    color: #333;
    border-bottom-color: #0066cc;
    font-weight: 500;
  }

  .transcript-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    margin-bottom: 8px;
    cursor: pointer;
    font-size: 16px;
    color: #e0e0e0;
    background: #0066cc;
    border: none;
    border-radius: 4px;
    user-select: none;
  }
</style>
