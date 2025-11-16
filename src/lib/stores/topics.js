import { writable, derived } from 'svelte/store';
import { transcript } from './transcript.js';
import { browser } from '$app/environment';

const STORAGE_KEY = 'convomap-topics';

// Configuration for topic detection
const CONFIG = {
  MIN_WORDS_FOR_ANALYSIS: 15, // minimum words before analyzing with Claude
  DEBOUNCE_MS: 2000, // wait 2 seconds after last speech before analyzing
};

// Store for topics and their relationships
function createTopicsStore() {
  // Load from localStorage on initialization
  const initialValue = browser ? (() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure all required fields exist
        return {
          nodes: parsed.nodes || [],
          edges: parsed.edges || [],
          currentTopicId: parsed.currentTopicId || null,
          lastProcessedIndex: parsed.lastProcessedIndex || 0,
          pendingText: parsed.pendingText || '',
          isAnalyzing: false, // Always start with false
        };
      }
    } catch (e) {
      console.error('Error loading topics from localStorage:', e);
    }
    return {
      nodes: [],
      edges: [],
      currentTopicId: null,
      lastProcessedIndex: 0,
      pendingText: '',
      isAnalyzing: false,
    };
  })() : {
    nodes: [],
    edges: [],
    currentTopicId: null,
    lastProcessedIndex: 0,
    pendingText: '',
    isAnalyzing: false,
  };

  const { subscribe, set, update } = writable(initialValue);

  // Auto-save to localStorage on changes (but not isAnalyzing)
  if (browser) {
    subscribe((state) => {
      try {
        // Don't save isAnalyzing state
        const toSave = {
          nodes: state.nodes,
          edges: state.edges,
          currentTopicId: state.currentTopicId,
          lastProcessedIndex: state.lastProcessedIndex,
          pendingText: state.pendingText,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (e) {
        console.error('Error saving topics to localStorage:', e);
      }
    });
  }

  let debounceTimer = null;

  // Call Claude API to analyze topic
  async function analyzeWithClaude(text, previousTopics) {
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
      console.error('Failed to analyze topic:', response.statusText);
      return null;
    }

    return await response.json();
  }

  // Helper to create a new topic node
  function createTopicNode(analysis, text, timestamp) {
    return {
      id: `topic-${timestamp}`,
      label: analysis.topicLabel,
      keywords: analysis.keywords,
      summary: analysis.summary,
      text: text,
      wordCount: text.split(/\s+/).length,
      timestamp: timestamp,
      x: analysis.x || 0,
      y: analysis.y || 0,
    };
  }

  // Process the pending text with Claude API
  async function processPendingText() {
    let currentState;
    
    // Get current state and mark as analyzing
    update(state => {
      currentState = state;
      return { ...state, isAnalyzing: true };
    });

    if (!currentState.pendingText) {
      update(state => ({ ...state, isAnalyzing: false }));
      return;
    }

    // Analyze with Claude
    const analysis = await analyzeWithClaude(currentState.pendingText, currentState.nodes);

    if (!analysis) {
      update(state => ({ ...state, isAnalyzing: false }));
      return;
    }

    const now = Date.now();
    const isNewTopic = analysis.isNewTopic;
    const matchingNode = !isNewTopic 
      ? currentState.nodes.find(node => node.label === analysis.matchingTopicLabel)
      : null;

    update(state => {
      let updatedNodes = [...state.nodes];
      let updatedEdges = [...state.edges];
      let newCurrentTopicId = state.currentTopicId;

      if (isNewTopic || !matchingNode) {
        // Create a new topic node
        const newNode = createTopicNode(analysis, currentState.pendingText, now);
        updatedNodes.push(newNode);

        // Create edge from previous topic to new topic
        if (state.currentTopicId !== null) {
          updatedEdges.push({
            source: state.currentTopicId,
            target: newNode.id,
            timestamp: now,
          });
        }

        newCurrentTopicId = newNode.id;
      } else {
        // Update existing topic
        updatedNodes = updatedNodes.map(node => {
          if (node.id === matchingNode.id) {
            const combinedText = node.text + ' ' + currentState.pendingText;
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
      }

      return {
        nodes: updatedNodes,
        edges: updatedEdges,
        currentTopicId: newCurrentTopicId,
        lastProcessedIndex: currentState.lastProcessedIndex,
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

  // Save current state to localStorage explicitly
  function save() {
    if (browser) {
      let currentState;
      const unsubscribe = subscribe((state) => {
        currentState = state;
      });
      unsubscribe();
      try {
        const toSave = {
          nodes: currentState.nodes,
          edges: currentState.edges,
          currentTopicId: currentState.currentTopicId,
          lastProcessedIndex: currentState.lastProcessedIndex,
          pendingText: currentState.pendingText,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (e) {
        console.error('Error saving topics to localStorage:', e);
      }
    }
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
    if (browser) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error('Error clearing topics from localStorage:', e);
      }
    }
  }

  // Load example data for testing
  function loadExampleData() {
    const now = Date.now();
    const exampleNodes = [
      {
        id: 'topic-1',
        label: 'Project Planning',
        keywords: ['planning', 'timeline', 'deadline', 'milestones'],
        summary: 'Discussion about project planning and scheduling',
        text: 'We need to plan the project timeline and set clear deadlines for all milestones. The team should coordinate on the schedule.',
        wordCount: 20,
        timestamp: now - 10000,
      },
      {
        id: 'topic-2',
        label: 'Technical Architecture',
        keywords: ['architecture', 'design', 'system', 'components'],
        summary: 'Technical discussion about system architecture and design',
        text: 'The technical architecture needs to be designed with modular components. We should consider scalability and maintainability.',
        wordCount: 18,
        timestamp: now - 8000,
      },
      {
        id: 'topic-3',
        label: 'Team Collaboration',
        keywords: ['team', 'collaboration', 'communication', 'meetings'],
        summary: 'Conversation about team collaboration and communication',
        text: 'Team collaboration is essential. We should improve communication channels and schedule regular meetings.',
        wordCount: 16,
        timestamp: now - 6000,
      },
      {
        id: 'topic-4',
        label: 'User Experience',
        keywords: ['UX', 'design', 'interface', 'usability'],
        summary: 'Discussion about user experience and interface design',
        text: 'The user experience needs improvement. We should focus on interface design and usability testing.',
        wordCount: 17,
        timestamp: now - 4000,
      },
      {
        id: 'topic-5',
        label: 'Performance Optimization',
        keywords: ['performance', 'optimization', 'speed', 'efficiency'],
        summary: 'Technical discussion about performance optimization',
        text: 'Performance optimization is critical. We need to improve speed and efficiency of the system.',
        wordCount: 15,
        timestamp: now - 2000,
      },
    ];

    const exampleEdges = [
      { source: 'topic-1', target: 'topic-2', timestamp: now - 9000 },
      { source: 'topic-2', target: 'topic-3', timestamp: now - 7000 },
      { source: 'topic-3', target: 'topic-4', timestamp: now - 5000 },
      { source: 'topic-4', target: 'topic-5', timestamp: now - 3000 },
      { source: 'topic-2', target: 'topic-5', timestamp: now - 2500 },
      { source: 'topic-1', target: 'topic-4', timestamp: now - 4500 },
    ];

    set({
      nodes: exampleNodes,
      edges: exampleEdges,
      currentTopicId: 'topic-5',
      lastProcessedIndex: 0,
      pendingText: '',
      isAnalyzing: false,
    });
  }

  // Get current topics data for export
  function exportData() {
    let currentState;
    const unsubscribe = subscribe((state) => {
      currentState = state;
    });
    unsubscribe();
    return {
      nodes: currentState.nodes,
      edges: currentState.edges,
      currentTopicId: currentState.currentTopicId,
      lastProcessedIndex: currentState.lastProcessedIndex,
      pendingText: currentState.pendingText,
    };
  }

  // Import topics data from external source
  function importData(data) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (data && typeof data === 'object') {
      set({
        nodes: Array.isArray(data.nodes) ? data.nodes : [],
        edges: Array.isArray(data.edges) ? data.edges : [],
        currentTopicId: data.currentTopicId || null,
        lastProcessedIndex: typeof data.lastProcessedIndex === 'number' ? data.lastProcessedIndex : 0,
        pendingText: data.pendingText || '',
        isAnalyzing: false,
      });
    } else {
      throw new Error('Invalid topics data format');
    }
  }

  return {
    subscribe,
    processTranscript,
    reset,
    loadExampleData,
    save,
    exportData,
    importData,
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
