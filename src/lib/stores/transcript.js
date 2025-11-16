import { writable } from 'svelte/store';

function createTranscriptStore() {
  const { subscribe, set, update } = writable([]);

  return {
    subscribe,
    addEntry: (text, isFinal) => update(entries => {
      // If there's an interim entry (last entry with isFinal=false), replace it
      if (entries.length > 0 && !entries[entries.length - 1].isFinal) {
        entries[entries.length - 1] = {
          text,
          isFinal,
          timestamp: new Date().toISOString()
        };
        return entries;
      }

      // Otherwise, add a new entry
      return [...entries, {
        text,
        isFinal,
        timestamp: new Date().toISOString()
      }];
    }),
    clear: () => set([])
  };
}

export const transcript = createTranscriptStore();
