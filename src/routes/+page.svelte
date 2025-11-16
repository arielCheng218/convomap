<script>
  import Tabs from './Tabs.svelte';
  import Transcript from './Transcript.svelte';
  import RecordingBar from './RecordingBar.svelte';

  let showTranscript = false;
</script>

<Tabs bind:showTranscript />

{#if showTranscript}
  <Transcript onClose={() => showTranscript = false} />
{/if}

<RecordingBar />
