<script>
  import { onMount, onDestroy } from 'svelte';
  import { graphData } from '$lib/stores/topics.js';
  import * as d3 from 'd3';

  let svg;
  let container;
  let width = 800;
  let height = 600;

  // Zoom and pan
  let transform = d3.zoomIdentity;

  onMount(() => {
    // Set up SVG dimensions
    const updateDimensions = () => {
      if (container) {
        width = container.clientWidth;
        height = container.clientHeight;
        renderVisualization();
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    // Subscribe to data changes
    const unsubscribe = graphData.subscribe(data => {
      renderVisualization();
    });

    return () => {
      window.removeEventListener('resize', updateDimensions);
      unsubscribe();
    };
  });

  function renderVisualization() {
    if (!svg) return;

    const data = $graphData;
    const { nodes, edges } = data;

    if (nodes.length === 0) return;

    // Clear previous render
    d3.select(svg).selectAll('*').remove();

    // Create main group for zoom/pan
    const g = d3.select(svg)
      .append('g')
      .attr('transform', transform);

    // Set up zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        transform = event.transform;
        g.attr('transform', transform);
      });

    d3.select(svg).call(zoom);

    // Create scales
    const xExtent = d3.extent(nodes, d => d.x);
    const yExtent = d3.extent(nodes, d => d.y);

    const xScale = d3.scaleLinear()
      .domain([Math.min(xExtent[0] - 20, -100), Math.max(xExtent[1] + 20, 100)])
      .range([50, width - 50]);

    const yScale = d3.scaleLinear()
      .domain([Math.min(yExtent[0] - 20, -100), Math.max(yExtent[1] + 20, 100)])
      .range([50, height - 50]);

    // Build path data - chronological order through topics
    const pathData = nodes
      .map(node => ({
        ...node,
        px: xScale(node.x),
        py: yScale(node.y)
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    // Create smooth path using d3.line with curve
    const line = d3.line()
      .x(d => d.px)
      .y(d => d.py)
      .curve(d3.curveCatmullRom.alpha(0.5)); // Smooth curve through points

    // Draw the path
    if (pathData.length > 1) {
      g.append('path')
        .datum(pathData)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', '#4a9eff')
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0.6);

      // Add arrow markers along the path to show direction
      const pathLength = pathData.length;
      for (let i = 0; i < pathLength - 1; i++) {
        const start = pathData[i];
        const end = pathData[i + 1];
        const midX = (start.px + end.px) / 2;
        const midY = (start.py + end.py) / 2;
        const angle = Math.atan2(end.py - start.py, end.px - start.px) * 180 / Math.PI;

        g.append('path')
          .attr('d', 'M 0,-3 L 6,0 L 0,3 Z')
          .attr('transform', `translate(${midX},${midY}) rotate(${angle})`)
          .attr('fill', '#4a9eff')
          .attr('opacity', 0.5);
      }
    }

    // Draw nodes
    const nodeGroups = g.selectAll('.node')
      .data(pathData)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.px},${d.py})`);

    // Node circles
    nodeGroups.append('circle')
      .attr('r', d => d.isActive ? 12 : 8)
      .attr('fill', d => d.isActive ? '#ff6b6b' : '#4ecdc4')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).transition().duration(200).attr('r', 14);
      })
      .on('mouseleave', function(event, d) {
        d3.select(this).transition().duration(200).attr('r', d.isActive ? 12 : 8);
      });

    // Node labels
    nodeGroups.append('text')
      .text(d => d.label)
      .attr('x', 0)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', d => d.isActive ? 'bold' : 'normal')
      .attr('fill', '#333')
      .style('pointer-events', 'none');

    // Add tooltips with keywords
    nodeGroups.append('title')
      .text(d => `${d.label}\n\n${d.summary}\n\nKeywords: ${d.keywords.join(', ')}`);

    // Auto-center on latest node
    if (pathData.length > 0 && nodes.some(n => n.isActive)) {
      const activeNode = pathData.find(n => n.isActive);
      if (activeNode) {
        const scale = 1;
        const x = -activeNode.px * scale + width / 2;
        const y = -activeNode.py * scale + height / 2;

        d3.select(svg)
          .transition()
          .duration(750)
          .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
      }
    }
  }
</script>

<div class="map-container" bind:this={container}>
  <svg bind:this={svg} {width} {height}></svg>

  {#if $graphData.isAnalyzing}
    <div class="analyzing-indicator">
      Analyzing conversation...
    </div>
  {/if}

  {#if $graphData.nodes.length === 0}
    <div class="empty-state">
      <p>Start speaking to see your conversation map</p>
      <p class="hint">Topics will appear as you talk, connected by a path showing your journey through the conversation</p>
    </div>
  {/if}

  <div class="legend">
    <div class="legend-item">
      <div class="legend-color active"></div>
      <span>Current Topic</span>
    </div>
    <div class="legend-item">
      <div class="legend-color past"></div>
      <span>Past Topics</span>
    </div>
    <div class="legend-item">
      <div class="legend-line"></div>
      <span>Conversation Path</span>
    </div>
  </div>

  <div class="axis-labels">
    <div class="x-axis-label left">Abstract</div>
    <div class="x-axis-label right">Concrete</div>
    <div class="y-axis-label top">Simple</div>
    <div class="y-axis-label bottom">Technical</div>
  </div>
</div>

<style>
  .map-container {
    position: relative;
    width: 100%;
    height: 100vh;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
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
    background: rgba(74, 158, 255, 0.9);
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 14px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 1; }
  }

  .empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #666;
  }

  .empty-state p {
    margin: 10px 0;
    font-size: 18px;
  }

  .empty-state .hint {
    font-size: 14px;
    color: #999;
    max-width: 400px;
  }

  .legend {
    position: absolute;
    bottom: 20px;
    left: 20px;
    background: rgba(255, 255, 255, 0.9);
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .legend-item {
    display: flex;
    align-items: center;
    margin: 8px 0;
    font-size: 14px;
  }

  .legend-color {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    margin-right: 10px;
    border: 2px solid white;
  }

  .legend-color.active {
    background: #ff6b6b;
  }

  .legend-color.past {
    background: #4ecdc4;
  }

  .legend-line {
    width: 30px;
    height: 3px;
    background: #4a9eff;
    margin-right: 10px;
    border-radius: 2px;
  }

  .axis-labels {
    pointer-events: none;
  }

  .x-axis-label, .y-axis-label {
    position: absolute;
    color: rgba(0, 0, 0, 0.3);
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .x-axis-label.left {
    left: 30px;
    top: 50%;
    transform: translateY(-50%);
  }

  .x-axis-label.right {
    right: 30px;
    top: 50%;
    transform: translateY(-50%);
  }

  .y-axis-label.top {
    top: 30px;
    left: 50%;
    transform: translateX(-50%);
  }

  .y-axis-label.bottom {
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
  }
</style>
