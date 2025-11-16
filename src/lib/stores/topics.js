import { writable, derived } from 'svelte/store';
import { transcript } from './transcript.js';

// Configuration for topic detection
const CONFIG = {
  MIN_WORDS_FOR_ANALYSIS: 15, // minimum words before analyzing with Claude
  DEBOUNCE_MS: 2000, // wait 2 seconds after last speech before analyzing
};

// Store for topics and their relationships
function createTopicsStore() {
  const { subscribe, set, update } = writable({
    nodes: [], // Array of topic nodes
    edges: [], // Array of edges between topics
    currentTopicId: null,
    lastProcessedIndex: 0,
    pendingText: '', // Text waiting to be analyzed
    isAnalyzing: false,
  });

  let debounceTimer = null;

  // Call Claude API to analyze topic
  async function analyzeWithClaude(text, previousTopics) {
    try {
      const response = await fetch('/api/analyze-topic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationText: text,
          previousTopics: previousTopics,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze topic');
      }

      return await response.json();
    } catch (error) {
      console.error('Error calling Claude API:', error);
      return null;
    }
  }

  // Process the pending text with Claude API
  async function processPendingText() {
    let textToAnalyze = '';
    let currentNodes = [];
    let currentTopicId = null;
    let lastIndex = 0;

    // Get current state
    update(state => {
      textToAnalyze = state.pendingText;
      currentNodes = state.nodes;
      currentTopicId = state.currentTopicId;
      lastIndex = state.lastProcessedIndex;
      return { ...state, isAnalyzing: true };
    });

    if (!textToAnalyze) {
      update(state => ({ ...state, isAnalyzing: false }));
      return;
    }

    // Analyze with Claude
    const analysis = await analyzeWithClaude(textToAnalyze, currentNodes);

    if (!analysis) {
      update(state => ({ ...state, isAnalyzing: false }));
      return;
    }

    const now = Date.now();

    update(state => {
      let updatedNodes = [...state.nodes];
      let updatedEdges = [...state.edges];
      let newCurrentTopicId = state.currentTopicId;

      if (analysis.isNewTopic) {
        // Create a new topic node
        const newTopicId = `topic-${now}`;
        const newNode = {
          id: newTopicId,
          label: analysis.topicLabel,
          keywords: analysis.keywords,
          summary: analysis.summary,
          text: textToAnalyze,
          wordCount: textToAnalyze.split(/\s+/).length,
          timestamp: now,
          x: analysis.x || 0,
          y: analysis.y || 0,
        };

        updatedNodes.push(newNode);

        // Create edge from previous topic to new topic
        if (state.currentTopicId !== null) {
          updatedEdges.push({
            source: state.currentTopicId,
            target: newTopicId,
            timestamp: now,
          });
        }

        newCurrentTopicId = newTopicId;
      } else {
        // Find and update existing topic
        const matchingNode = updatedNodes.find(
          node => node.label === analysis.matchingTopicLabel
        );

        if (matchingNode) {
          updatedNodes = updatedNodes.map(node => {
            if (node.id === matchingNode.id) {
              const combinedText = node.text + ' ' + textToAnalyze;
              return {
                ...node,
                text: combinedText,
                keywords: analysis.keywords,
                summary: analysis.summary,
                wordCount: combinedText.split(/\s+/).length,
                x: analysis.x !== undefined ? analysis.x : node.x,
                y: analysis.y !== undefined ? analysis.y : node.y,
              };
            }
            return node;
          });

          // Create edge if transitioning back to a previous topic
          if (state.currentTopicId !== null && state.currentTopicId !== matchingNode.id) {
            const edgeExists = updatedEdges.some(
              edge => edge.source === state.currentTopicId && edge.target === matchingNode.id
            );
            if (!edgeExists) {
              updatedEdges.push({
                source: state.currentTopicId,
                target: matchingNode.id,
                timestamp: now,
              });
            }
          }

          newCurrentTopicId = matchingNode.id;
        } else {
          // Fallback: create new topic if matching topic not found
          const newTopicId = `topic-${now}`;
          const newNode = {
            id: newTopicId,
            label: analysis.topicLabel,
            keywords: analysis.keywords,
            summary: analysis.summary,
            text: textToAnalyze,
            wordCount: textToAnalyze.split(/\s+/).length,
            timestamp: now,
            x: analysis.x || 0,
            y: analysis.y || 0,
          };

          updatedNodes.push(newNode);

          if (state.currentTopicId !== null) {
            updatedEdges.push({
              source: state.currentTopicId,
              target: newTopicId,
              timestamp: now,
            });
          }

          newCurrentTopicId = newTopicId;
        }
      }

      return {
        nodes: updatedNodes,
        edges: updatedEdges,
        currentTopicId: newCurrentTopicId,
        lastProcessedIndex: lastIndex,
        pendingText: '',
        isAnalyzing: false,
      };
    });
  }

  // Process new transcript entries
  function processTranscript(transcriptEntries) {
    update(state => {
      const finalEntries = transcriptEntries.filter(entry => entry.isFinal);

      if (finalEntries.length === 0) {
        return state;
      }

      // Get unprocessed entries
      const newEntries = finalEntries.slice(state.lastProcessedIndex);

      if (newEntries.length === 0) {
        return state;
      }

      // Combine new text
      const newText = newEntries.map(entry => entry.text).join(' ');
      const combinedPending = (state.pendingText + ' ' + newText).trim();
      const wordCount = combinedPending.split(/\s+/).filter(w => w.length > 0).length;

      // Clear any existing debounce timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Update pending text
      const updatedState = {
        ...state,
        pendingText: combinedPending,
        lastProcessedIndex: finalEntries.length,
      };

      // If we have enough words, schedule analysis
      if (wordCount >= CONFIG.MIN_WORDS_FOR_ANALYSIS) {
        debounceTimer = setTimeout(() => {
          processPendingText();
        }, CONFIG.DEBOUNCE_MS);
      }

      return updatedState;
    });
  }

  // Reset the topics store
  function reset() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    set({
      nodes: [],
      edges: [],
      currentTopicId: null,
      lastProcessedIndex: 0,
      pendingText: '',
      isAnalyzing: false,
    });
  }

  return {
    subscribe,
    processTranscript,
    reset,
  };
}

export const topics = createTopicsStore();

// Auto-subscribe to transcript changes
transcript.subscribe(entries => {
  topics.processTranscript(entries);
});

// Derived store for graph visualization data
export const graphData = derived(topics, $topics => ({
  nodes: $topics.nodes.map(node => ({
    ...node,
    size: Math.max(30, Math.min(100, node.wordCount / 3)), // Scale node size by word count
    isActive: node.id === $topics.currentTopicId,
  })),
  edges: $topics.edges,
  isAnalyzing: $topics.isAnalyzing,
}));
