<script>
  import { transcript } from '../lib/stores/transcript.js';

  export let onClose;

  let transcriptContainer;
  let previousLength = 0;

  // Auto-scroll to bottom only when new content is added
  $: if (transcriptContainer && $transcript.length > previousLength) {
    previousLength = $transcript.length;
    setTimeout(() => {
      const { scrollTop, scrollHeight, clientHeight } = transcriptContainer;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      if (isNearBottom) {
        transcriptContainer.scrollTop = scrollHeight;
      }
    }, 0);
  }
</script>

<div class="transcript-panel">
  <button class="close-button" on:click={onClose}>×</button>
  <h2>Live Transcript</h2>

  <div class="transcript-container" bind:this={transcriptContainer}>
    {#if $transcript.length === 0}
      <p class="empty-message">Click "Start" to begin recording and see live transcription...</p>
    {:else}
      {#each $transcript as entry (entry.timestamp)}
        <div class="transcript-entry" class:interim={!entry.isFinal}>
          <p>{entry.text}</p>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .transcript-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100vh;
    background: white;
    border-left: 2px solid #e0e0e0;
    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  }

  .close-button {
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    font-size: 32px;
    cursor: pointer;
    color: #666;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .close-button:hover {
    background-color: #f0f0f0;
    color: #333;
  }

  h2 {
    margin-top: 60px;
    margin-bottom: 20px;
    font-size: 16px;
    font-weight: 500;
    color: #333;
  }

  .transcript-container {
    height: calc(100vh - 140px);
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 10px;
  }

  .empty-message {
    color: #999;
    font-style: italic;
    text-align: center;
    padding: 40px 20px;
    font-size: 16px;
  }

  .transcript-entry {
    margin-bottom: 16px;
    padding: 12px;
    background: #f9f9f9;
    border-radius: 6px;
    border-left: 3px solid #0066cc;
    transition: all 0.2s;
  }

  .transcript-entry.interim {
    background: #e8f4ff;
    border-left-color: #99ccff;
    opacity: 0.7;
  }

  .transcript-entry p {
    margin: 0;
    line-height: 1.6;
    color: #333;
    font-size: 16px;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .transcript-container::-webkit-scrollbar {
    width: 8px;
  }

  .transcript-container::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  .transcript-container::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 4px;
  }

  .transcript-container::-webkit-scrollbar-thumb:hover {
    background: #999;
  }
</style>
