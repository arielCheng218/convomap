<script>
  import Graph from './Graph.svelte';
  import Map from './Map.svelte';
  import { onMount } from 'svelte';

  export let showTranscript = false;

  let activeTab = 'graph';
  let isFullscreen = false;
  let tabContentElement;

  onMount(() => {
    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      isFullscreen = !!document.fullscreenElement;
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  });

  async function toggleFullscreen() {
    if (!tabContentElement) return;

    try {
      if (!isFullscreen) {
        // Enter fullscreen
        if (tabContentElement.requestFullscreen) {
          await tabContentElement.requestFullscreen();
        } else if (tabContentElement.webkitRequestFullscreen) {
          await tabContentElement.webkitRequestFullscreen();
        } else if (tabContentElement.mozRequestFullScreen) {
          await tabContentElement.mozRequestFullScreen();
        } else if (tabContentElement.msRequestFullscreen) {
          await tabContentElement.msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  }
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
  <div class="header-actions">
    <button class="fullscreen-button" on:click={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
      {isFullscreen ? '⤓' : '⛶'}
    </button>
    <button class="transcript-toggle" on:click={() => showTranscript = true}>
      Open Transcript
    </button>
  </div>
</div>

<div class="tab-content" class:fullscreen={isFullscreen} bind:this={tabContentElement}>
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .fullscreen-button {
    padding: 10px 16px;
    margin-bottom: 8px;
    cursor: pointer;
    font-size: 18px;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    user-select: none;
    transition: background 0.2s;
  }

  .fullscreen-button:hover {
    background: #5a6268;
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

  .tab-content {
    height: calc(100vh - 100px);
    position: relative;
    transition: height 0.2s;
    overflow: hidden;
  }

  .tab-content.fullscreen {
    height: 100vh;
  }

  /* When in fullscreen, remove any margins/padding */
  :global(:fullscreen) .tab-content,
  :global(:-webkit-full-screen) .tab-content,
  :global(:-moz-full-screen) .tab-content,
  :global(:-ms-fullscreen) .tab-content {
    margin: 0;
    padding: 0;
    border: none;
  }
</style>
