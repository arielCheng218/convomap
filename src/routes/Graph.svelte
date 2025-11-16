<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { graphData, topics } from '$lib/stores/topics.js';

  let svg;
  let simulation;
  let container;
  let nodePositions = new Map(); // Store node positions to preserve across updates
  let previousNodeIds = new Set(); // Track previous node IDs to detect actual changes
  let currentLinkSelection = null; // Store current link selection for tick handler
  let currentNodeSelection = null; // Store current node selection for tick handler
  let currentNodesWithPositions = []; // Store current nodes for tick handler

  $: data = $graphData;

  onMount(() => {
    createVisualization();
    
    // Handle window resize and fullscreen changes
    const handleResize = () => {
      if (container && svg) {
        const isFullscreen = !!document.fullscreenElement;
        const width = window.innerWidth;
        const height = isFullscreen ? window.innerHeight : window.innerHeight - 100;
        d3.select(svg)
          .attr('width', width)
          .attr('height', height);
        if (simulation) {
          simulation.force('center', d3.forceCenter(width / 2, height / 2));
          simulation.alpha(0.3).restart();
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    document.addEventListener('webkitfullscreenchange', handleResize);
    document.addEventListener('mozfullscreenchange', handleResize);
    document.addEventListener('MSFullscreenChange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
      document.removeEventListener('webkitfullscreenchange', handleResize);
      document.removeEventListener('mozfullscreenchange', handleResize);
      document.removeEventListener('MSFullscreenChange', handleResize);
      if (simulation) {
        simulation.stop();
      }
    };
  });

  $: if (data && svg) {
    updateVisualization(data);
  }

  function createVisualization() {
    // Use viewport dimensions to fill the page
    const isFullscreen = !!document.fullscreenElement;
    const width = window.innerWidth;
    const height = isFullscreen ? window.innerHeight : window.innerHeight - 100; // Account for header/tabs

    // Create SVG
    const svgElement = d3.select(svg)
      .attr('width', width)
      .attr('height', height);

    // Clear any existing content
    svgElement.selectAll('*').remove();

    // Create a group for zoom/pan
    const g = svgElement.append('g');

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svgElement.call(zoom);

    // Create force simulation
    simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.size + 10))
      .on('tick', tickHandler); // Set up tick handler once

    // Create arrow marker for directed edges with modern styling
    svgElement.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#4a5568')
      .attr('opacity', 0.8);

    // Store the group for updates
    svg._d3Group = g;
  }

  // Tick handler function - updates links and nodes
  function tickHandler() {
    if (!currentLinkSelection || !currentNodeSelection) return;

    currentLinkSelection.each(function(d) {
      // Resolve source and target to actual node objects if they're IDs
      const source = typeof d.source === 'string' 
        ? currentNodesWithPositions.find(n => n.id === d.source) 
        : d.source;
      const target = typeof d.target === 'string'
        ? currentNodesWithPositions.find(n => n.id === d.target)
        : d.target;
      
      // Ensure we have valid node objects with coordinates
      if (!source || !target || source.x === undefined || target.x === undefined) {
        return;
      }
      
      const sourceRadius = (typeof source.size === 'number' ? source.size : 30);
      const targetRadius = (typeof target.size === 'number' ? target.size : 30);
      
      // Calculate angle between nodes
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Avoid division by zero
      if (distance === 0) return;
      
      const angle = Math.atan2(dy, dx);
      
      // Calculate intersection points on circle edges
      const sourceX = source.x + Math.cos(angle) * sourceRadius;
      const sourceY = source.y + Math.sin(angle) * sourceRadius;
      const targetX = target.x - Math.cos(angle) * targetRadius;
      const targetY = target.y - Math.sin(angle) * targetRadius;
      
      d3.select(this)
        .attr('x1', sourceX)
        .attr('y1', sourceY)
        .attr('x2', targetX)
        .attr('y2', targetY);
    });

    currentNodeSelection.each(function(d) {
      // Save node position to persistent storage
      nodePositions.set(d.id, {
        x: d.x,
        y: d.y,
        fx: d.fx,
        fy: d.fy,
        vx: d.vx,
        vy: d.vy
      });
    });

    currentNodeSelection
      .attr('transform', d => `translate(${d.x},${d.y})`);
  }

  function updateVisualization(data) {
    if (!svg || !svg._d3Group) return;

    const g = svg._d3Group;

    // Check if nodes actually changed (by ID)
    const currentNodeIds = new Set(data.nodes.map(n => n.id));
    const nodesChanged = 
      currentNodeIds.size !== previousNodeIds.size ||
      [...currentNodeIds].some(id => !previousNodeIds.has(id));
    
    // Restore positions for existing nodes before updating
    const nodesWithPositions = data.nodes.map(node => {
      const stored = nodePositions.get(node.id);
      if (stored) {
        return {
          ...node,
          x: stored.x,
          y: stored.y,
          fx: stored.fx,
          fy: stored.fy,
          vx: stored.vx,
          vy: stored.vy
        };
      }
      return node;
    });

    // Update links - ensure edges reference nodes by ID
    const edgesWithNodeRefs = data.edges.map(edge => ({
      ...edge,
      source: typeof edge.source === 'string' ? edge.source : (edge.source.id || edge.source),
      target: typeof edge.target === 'string' ? edge.target : (edge.target.id || edge.target),
    }));

    const link = g.selectAll('.link')
      .data(edgesWithNodeRefs, d => `${d.source}-${d.target}`);

    link.exit().remove();

    const linkEnter = link.enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#4a5568')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 2.5)
      .attr('marker-end', 'url(#arrowhead)')
      .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))');

    const linkMerge = linkEnter.merge(link);

    // Update nodes - use nodes with preserved positions
    const node = g.selectAll('.node')
      .data(nodesWithPositions, d => d.id);

    node.exit().remove();

    const nodeEnter = node.enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles to nodes
    nodeEnter.append('circle')
      .attr('class', 'node-circle');

    // Add labels to nodes
    nodeEnter.append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '.3em')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#fff')
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    // Add keyword labels below nodes
    nodeEnter.append('text')
      .attr('class', 'node-keywords')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.5em')
      .style('font-size', '9px')
      .style('fill', '#666')
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    const nodeMerge = nodeEnter.merge(node);

    // Update node appearance with modern styling
    nodeMerge.select('.node-circle')
      .transition()
      .duration(300)
      .attr('r', d => d.size)
      .attr('fill', d => d.isActive ? '#0066cc' : '#4a90e2')
      .attr('stroke', d => d.isActive ? '#ff6b35' : '#ffffff')
      .attr('stroke-width', d => d.isActive ? 4 : 3)
      .style('cursor', 'pointer')
      .style('filter', d => d.isActive 
        ? 'drop-shadow(0 8px 16px rgba(255, 107, 53, 0.6)) drop-shadow(0 4px 8px rgba(0, 102, 204, 0.4))'
        : 'drop-shadow(0 4px 12px rgba(74, 144, 226, 0.4)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))');

    // Update labels
    nodeMerge.select('.node-label')
      .text(d => {
        const maxLength = Math.floor(d.size / 4);
        return d.label.length > maxLength ? d.label.substring(0, maxLength) + '...' : d.label;
      });

    nodeMerge.select('.node-keywords')
      .text(d => d.keywords ? d.keywords.slice(0, 2).join(', ') : '');

    // Add tooltip
    nodeMerge.on('mouseover', function(event, d) {
      d3.select(this).select('.node-circle')
        .transition()
        .duration(200)
        .attr('r', d.size * 1.2);

      // Show tooltip
      showTooltip(event, d);
    })
    .on('mouseout', function(event, d) {
      d3.select(this).select('.node-circle')
        .transition()
        .duration(200)
        .attr('r', d.size);

      hideTooltip();
    });

    // Store current selections for tick handler
    currentLinkSelection = linkMerge;
    currentNodeSelection = nodeMerge;
    currentNodesWithPositions = nodesWithPositions;

    // Update simulation with nodes that have preserved positions
    simulation.nodes(nodesWithPositions);
    simulation.force('link').links(edgesWithNodeRefs);
    
    // Only restart simulation if nodes actually changed
    if (nodesChanged) {
      simulation.alpha(0.3).restart();
    } else {
      // Just update the simulation without restarting if only properties changed
      simulation.alpha(0.1).restart();
    }
    
    // Update previous node IDs
    previousNodeIds = currentNodeIds;
  }

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  let tooltip = null;

  function showTooltip(event, d) {
    if (!tooltip) {
      tooltip = d3.select('body')
        .append('div')
        .attr('class', 'graph-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', '#fff')
        .style('padding', '10px')
        .style('border-radius', '5px')
        .style('pointer-events', 'none')
        .style('font-size', '12px')
        .style('max-width', '300px')
        .style('z-index', '1000');
    }

    tooltip
      .style('opacity', 1)
      .html(`
        <strong>${d.label}</strong><br/>
        <em>${d.summary || ''}</em><br/>
        <small>Words: ${d.wordCount}</small><br/>
        <small>Keywords: ${d.keywords ? d.keywords.join(', ') : ''}</small>
      `)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 28) + 'px');
  }

  function hideTooltip() {
    if (tooltip) {
      tooltip.style('opacity', 0);
    }
  }
</script>

<div class="graph-container" bind:this={container}>
  <svg bind:this={svg}></svg>

  <button class="test-data-button" on:click={() => topics.loadExampleData()}>
    Load Test Data
  </button>

  {#if data.isAnalyzing}
    <div class="analyzing-indicator">
      <div class="spinner"></div>
      <span>Analyzing conversation...</span>
    </div>
  {/if}

  {#if data.nodes.length === 0 && !data.isAnalyzing}
    <div class="empty-state">
      <p>Start recording to see conversation topics appear as a graph</p>
      <p class="hint">Topics will be automatically detected and visualized in real-time</p>
    </div>
  {/if}
</div>

<style>
  .graph-container {
    width: 100%;
    height: 100%;
    min-height: calc(100vh - 100px);
    position: relative;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    overflow: hidden;
  }

  svg {
    width: 100%;
    height: 100%;
  }

  .test-data-button {
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    padding: 10px 20px;
    border: none;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
    z-index: 10;
    transition: all 0.2s;
  }

  .test-data-button:hover {
    background: rgba(255, 255, 255, 1);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25), 0 3px 6px rgba(0, 0, 0, 0.15);
  }

  .test-data-button:active {
    transform: translateY(0);
  }

  .analyzing-indicator {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 12px 24px;
    border-radius: 24px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(10px);
    z-index: 10;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: white;
    font-size: 18px;
    max-width: 400px;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .empty-state p {
    margin: 10px 0;
  }

  .empty-state .hint {
    font-size: 14px;
    opacity: 0.8;
  }

  :global(.graph-tooltip) {
    transition: opacity 0.3s;
  }
</style>
