import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'convomap-transcript';

/**
 * Transcript entry structure:
 * {
 *   id: string (unique identifier)
 *   text: string
 *   isFinal: boolean
 *   timestamp: string (ISO date string)
 *   confidence: number (optional)
 * }
 */

function createTranscriptStore() {
	// Load from localStorage on initialization
	const initialValue = browser ? (() => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			return stored ? JSON.parse(stored) : [];
		} catch (e) {
			console.error('Error loading transcript from localStorage:', e);
			return [];
		}
	})() : [];

	const { subscribe, set, update } = writable(initialValue);

	// Auto-save to localStorage on changes
	if (browser) {
		subscribe((entries) => {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
			} catch (e) {
				console.error('Error saving transcript to localStorage:', e);
			}
		});
	}

	return {
		subscribe,
		
		/**
		 * Save current state to localStorage explicitly
		 */
		save: () => {
			if (browser) {
				let currentEntries = [];
				const unsubscribe = subscribe((entries) => {
					currentEntries = entries;
				});
				unsubscribe();
				try {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(currentEntries));
				} catch (e) {
					console.error('Error saving transcript to localStorage:', e);
				}
			}
		},

		/**
		 * Clear all transcript entries and localStorage
		 */
		clear: () => {
			set([]);
			if (browser) {
				try {
					localStorage.removeItem(STORAGE_KEY);
				} catch (e) {
					console.error('Error clearing transcript from localStorage:', e);
				}
			}
		},
		
		/**
		 * Add a new transcript entry
		 * @param {string} text - The transcript text
		 * @param {boolean} isFinal - Whether this is a final result
		 * @param {number} [confidence] - Optional confidence score
		 */
		addEntry: (text, isFinal, confidence = null) => {
			if (!text || text.trim().length === 0) {
				return; // Don't add empty entries
			}

			update((entries) => {
				// If this is an interim result, replace the last interim entry if it exists
				if (!isFinal && entries.length > 0) {
					const lastEntry = entries[entries.length - 1];
					if (!lastEntry.isFinal) {
						// Replace the last interim entry
						return [
							...entries.slice(0, -1),
							{
								id: lastEntry.id, // Keep the same ID
								text: text.trim(),
								isFinal: false,
								timestamp: lastEntry.timestamp, // Keep original timestamp
								confidence: confidence ?? lastEntry.confidence
							}
						];
					}
				}

				// If this is a final result, remove the last interim entry if it exists
				if (isFinal && entries.length > 0) {
					const lastEntry = entries[entries.length - 1];
					if (!lastEntry.isFinal) {
						// Remove the interim entry and add the final one
						return [
							...entries.slice(0, -1),
							{
								id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
								text: text.trim(),
								isFinal: true,
								timestamp: new Date().toISOString(),
								confidence
							}
						];
					}
				}

				// Add a new entry (either final or first interim)
				return [
					...entries,
					{
						id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
						text: text.trim(),
						isFinal,
						timestamp: new Date().toISOString(),
						confidence
					}
				];
			});
		},

		/**
		 * Remove a specific entry by ID
		 * @param {string} id - The entry ID to remove
		 */
		removeEntry: (id) => {
			update((entries) => entries.filter((entry) => entry.id !== id));
		},

		/**
		 * Get all final transcript entries as a single string
		 * @returns {string} Combined final transcript text
		 */
		getFinalText: () => {
			let finalText = '';
			const unsubscribe = subscribe((entries) => {
				finalText = entries
					.filter((entry) => entry.isFinal)
					.map((entry) => entry.text)
					.join(' ');
			});
			unsubscribe();
			return finalText;
		},

		/**
		 * Get current transcript data for export
		 * @returns {Array} Current transcript entries
		 */
		exportData: () => {
			let currentEntries = [];
			const unsubscribe = subscribe((entries) => {
				currentEntries = entries;
			});
			unsubscribe();
			return currentEntries;
		},

		/**
		 * Import transcript data from external source
		 * @param {Array} entries - Transcript entries to import
		 */
		importData: (entries) => {
			if (Array.isArray(entries)) {
				set(entries);
			} else {
				throw new Error('Invalid transcript data format');
			}
		}
	};
}

export const transcript = createTranscriptStore();
