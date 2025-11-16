<script>
	import favicon from '$lib/assets/favicon.svg';
	import { transcript } from '$lib/stores/transcript.js';
	import { topics } from '$lib/stores/topics.js';
	import { browser } from '$app/environment';

	let { children } = $props();
	let fileInput;

	function saveData() {
		transcript.save();
		topics.save();
		alert('Data saved to local storage!');
	}

	function clearData() {
		if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
			transcript.clear();
			topics.reset();
			alert('All data cleared!');
		}
	}

	function exportData() {
		if (!browser) return;
		
		try {
			const exportData = {
				version: '1.0',
				exportedAt: new Date().toISOString(),
				transcript: transcript.exportData(),
				topics: topics.exportData(),
			};

			const blob = new Blob([JSON.stringify(exportData, null, 2)], {
				type: 'application/json',
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `convomap-export-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			alert('Data exported successfully!');
		} catch (error) {
			console.error('Error exporting data:', error);
			alert('Error exporting data: ' + error.message);
		}
	}

	function importData() {
		if (!browser) return;
		fileInput?.click();
	}

	async function handleFileImport(event) {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			const data = JSON.parse(text);

			// Validate data structure
			if (!data.transcript || !data.topics) {
				throw new Error('Invalid file format. Expected transcript and topics data.');
			}

			if (!confirm('Importing data will replace your current data. Continue?')) {
				// Reset file input
				if (fileInput) fileInput.value = '';
				return;
			}

			// Import the data
			transcript.importData(data.transcript);
			topics.importData(data.topics);

			// Save to localStorage
			transcript.save();
			topics.save();

			alert('Data imported successfully!');
		} catch (error) {
			console.error('Error importing data:', error);
			alert('Error importing data: ' + error.message);
		} finally {
			// Reset file input
			if (fileInput) fileInput.value = '';
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="top-bar">
	<div class="top-bar-content">
		<h1 class="app-title">ConvoMap</h1>
		<div class="actions">
			<button class="export-button" on:click={exportData}>📤 Export</button>
			<button class="import-button" on:click={importData}>📥 Import</button>
			<button class="save-button" on:click={saveData}>💾 Save</button>
			<button class="clear-button" on:click={clearData}>🗑️ Clear</button>
		</div>
		<input
			bind:this={fileInput}
			type="file"
			accept=".json,application/json"
			style="display: none;"
			on:change={handleFileImport}
		/>
	</div>
</div>

{@render children()}

<style>
	.top-bar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 60px;
		background: white;
		border-bottom: 2px solid #e0e0e0;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		z-index: 1000;
	}

	.top-bar-content {
		max-width: 1200px;
		margin: 0 auto;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 20px;
	}

	.app-title {
		margin: 0;
		font-size: 24px;
		font-weight: 600;
		color: #333;
	}

	.actions {
		display: flex;
		gap: 10px;
	}

	.export-button,
	.import-button,
	.save-button,
	.clear-button {
		padding: 8px 16px;
		font-size: 14px;
		font-weight: 500;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.export-button {
		background: #007bff;
		color: white;
	}

	.export-button:hover {
		background: #0056b3;
	}

	.import-button {
		background: #17a2b8;
		color: white;
	}

	.import-button:hover {
		background: #138496;
	}

	.save-button {
		background: #28a745;
		color: white;
	}

	.save-button:hover {
		background: #218838;
	}

	.clear-button {
		background: #dc3545;
		color: white;
	}

	.clear-button:hover {
		background: #c82333;
	}
</style>
