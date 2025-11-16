<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { graphData } from '$lib/stores/topics.js';

  let svg;
  let simulation;
  let container;

  $: data = $graphData;

  onMount(() => {
    createVisualization();
    return () => {
      if (simulation) {
        simulation.stop();
      }
    };
  });

  $: if (data && svg) {
    updateVisualization(data);
  }

  function createVisualization() {
    const width = container.clientWidth;
    const height = container.clientHeight;

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
      .force('collision', d3.forceCollide().radius(d => d.size + 10));

    // Create arrow marker for directed edges
    svgElement.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#999');

    // Store the group for updates
    svg._d3Group = g;
  }

  function updateVisualization(data) {
    if (!svg || !svg._d3Group) return;

    const g = svg._d3Group;

    // Update links
    const link = g.selectAll('.link')
      .data(data.edges, d => `${d.source.id || d.source}-${d.target.id || d.target}`);

    link.exit().remove();

    const linkEnter = link.enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');

    const linkMerge = linkEnter.merge(link);

    // Update nodes
    const node = g.selectAll('.node')
      .data(data.nodes, d => d.id);

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

    // Update node appearance
    nodeMerge.select('.node-circle')
      .transition()
      .duration(300)
      .attr('r', d => d.size)
      .attr('fill', d => d.isActive ? '#0066cc' : '#4a90e2')
      .attr('stroke', d => d.isActive ? '#ff6b35' : '#fff')
      .attr('stroke-width', d => d.isActive ? 4 : 2)
      .style('cursor', 'pointer')
      .style('filter', d => d.isActive ? 'drop-shadow(0 0 10px rgba(255, 107, 53, 0.8))' : 'none');

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

    // Update simulation
    simulation.nodes(data.nodes);
    simulation.force('link').links(data.edges);
    simulation.alpha(0.3).restart();

    // Tick function
    simulation.on('tick', () => {
      linkMerge
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodeMerge
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });
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
    position: relative;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    overflow: hidden;
  }

  svg {
    width: 100%;
    height: 100%;
  }

  .analyzing-indicator {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
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
