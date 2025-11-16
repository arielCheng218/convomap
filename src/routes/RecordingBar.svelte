<script>
  import { transcript } from '../lib/stores/transcript.js';

  let isRecording = false;
  let recognition;

  async function toggleRecording() {
    if (!isRecording) {
      try {
        // Check if Web Speech API is supported
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
          alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
          return;
        }

        // Create speech recognition instance
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        // Handle results
        recognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcriptText = result[0].transcript;
            const isFinal = result.isFinal;

            transcript.addEntry(transcriptText, isFinal);
          }
        };

        // Handle errors
        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'no-speech') {
            console.log('No speech detected. Continuing...');
          } else if (event.error === 'not-allowed') {
            alert('Microphone access denied. Please grant permission.');
            isRecording = false;
          }
        };

        // Handle end (auto-restart if still recording)
        recognition.onend = () => {
          if (isRecording) {
            recognition.start();
          }
        };

        // Start recognition
        recognition.start();
        isRecording = true;

      } catch (error) {
        console.error('Error starting speech recognition:', error);
        alert('Could not start speech recognition. Please try again.');
      }
    } else {
      // Stop recording
      if (recognition) {
        recognition.stop();
        recognition = null;
      }
      isRecording = false;

      // Log the transcript strings
      setTimeout(() => {
        transcript.subscribe(value => {
          console.log('Transcript Strings:', value);
        });
      }, 100);
    }
  }
</script>

<div class="bottom-bar">
  <button class="record-button" on:click={toggleRecording}>
    {isRecording ? 'Stop' : 'Start'}
  </button>
</div>

<style>
  .bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: white;
    border-top: 2px solid #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  }

  .record-button {
    padding: 12px 32px;
    font-size: 16px;
    font-weight: 500;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    background: #0066cc;
    color: white;
  }

  .record-button:hover {
    background: #0052a3;
  }
</style>
