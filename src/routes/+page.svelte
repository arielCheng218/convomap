<script>
  import Tabs from './Tabs.svelte';
  import Transcript from './Transcript.svelte';
  import RecordingBar from './RecordingBar.svelte';

  let showTranscript = false;
</script>

<div class="page-content">
  <Tabs bind:showTranscript />

  {#if showTranscript}
    <Transcript onClose={() => showTranscript = false} />
  {/if}
</div>

<RecordingBar />

<style>
  .page-content {
    padding-top: 60px; /* Account for top bar */
    padding-bottom: 60px; /* Account for bottom recording bar */
    min-height: 100vh;
  }
</style>
