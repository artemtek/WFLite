import { lite2lg } from "./scripts/lite-to-lg.js";
import { getSequence, simplifyGraph } from "./scripts/compile-graph.js";
import { initPluginManagement } from "./scripts/plugin-management.js";
import { liteAPI } from "./api.js";

const GRAPH_KEY = "lite.graph.fanout";

function persistGraph(graph) {
  if (!graph) return;
  sessionStorage.setItem(GRAPH_KEY, JSON.stringify(graph.serialize()));
}

async function runApp() {
  if (LiteGraph.registered_node_types) {
    const customNodes = {};
    const allowedInputNodes = ['input/folder_picker'];
    Object.keys(LiteGraph.registered_node_types).forEach(nodeTypeName => {
      if (nodeTypeName.startsWith('plugin/')) {
        customNodes[nodeTypeName] = LiteGraph.registered_node_types[nodeTypeName];
      } else if (allowedInputNodes.includes(nodeTypeName)) {
        customNodes[nodeTypeName] = LiteGraph.registered_node_types[nodeTypeName];
      }
    });
    LiteGraph.registered_node_types = customNodes;
  }

  async function reloadPlugins() {
    try {
      const plugins = await liteAPI.loadPlugins();
      plugins.forEach(plugin => {
        const nodeClass = lite2lg(plugin);
        LiteGraph.registerNodeType("plugin/" + nodeClass.id, nodeClass);
      });
      log(`Loaded ${plugins.length} plugin(s)`, 'success');
    } catch (error) {
      log(`Error loading plugins: ${error.message}`, 'error');
    }
  }

  await reloadPlugins();
  window.reloadPlugins = reloadPlugins;

  const originalGetNodeMenuOptions = LGraphCanvas.prototype.getNodeMenuOptions;
  LGraphCanvas.prototype.getNodeMenuOptions = function(node) {
    const options = originalGetNodeMenuOptions ? originalGetNodeMenuOptions.call(this, node) : [];
    const optionsToRemove = ['Mode', 'Properties', 'Resize'];
    return options.filter(option => {
      if (typeof option === 'string') {
        return !optionsToRemove.includes(option);
      }
      if (option && typeof option === 'object') {
        const optionValue = option.content || option.text || option.title || option;
        return !optionsToRemove.includes(optionValue);
      }
      return true;
    });
  };

  const graph = new LGraph();
  const canvas = new LGraphCanvas("#mycanvas", graph);
  window.graph = graph;
  window.canvas = canvas;

  const saved = sessionStorage.getItem(GRAPH_KEY);
  if (saved) {
    try {
      graph.configure(JSON.parse(saved));
    } catch (e) {
      console.error(e);
      createDefaultGraph(graph);
    }
  } else {
    createDefaultGraph(graph);
  }

  applyPickedFolder(graph);

  function resizeCanvas() {
    const el = document.getElementById('mycanvas');
    const workspace = document.querySelector('.workspace');
    el.width = workspace.clientWidth * 0.7;
    el.height = workspace.clientHeight;
  }
  resizeCanvas();
  fitGraphToCanvas(canvas, graph);
  window.addEventListener('resize', resizeCanvas);

  function log(message, type = 'info') {
    const logArea = document.getElementById('log');
    const colorClass = type === 'error' ? 'error' :
                      type === 'success' ? 'success' :
                      type === 'warning' ? 'warning' : 'info';
    const escapedMessage = String(message)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    logArea.innerHTML += `\n<span class="${colorClass}">${escapedMessage}</span>\n>`;
    logArea.scrollTop = logArea.scrollHeight;
  }
  window.log = log;

  document.getElementById('filesNavLink').addEventListener('click', () => persistGraph(graph));

  document.getElementById('stopBtn').addEventListener('click', async () => {
    try {
      log('=== Stopping Workflow ===', 'warning');
      const result = await liteAPI.killWorkflowProcesses();
      if (result.success) {
        log(`✓ ${result.message}`, 'success');
      } else {
        log(`✗ Failed to stop workflow: ${result.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      log(`✗ Error stopping workflow: ${error.message}`, 'error');
    }
  });

  document.getElementById('executeBtn').addEventListener('click', async () => {
    const serializedGraph = graph.serialize();
    persistGraph(graph);
    try {
      simplifyGraph(serializedGraph);
      getSequence(simplifyGraph(serializedGraph));
    } catch (e) {
      log(`✗ ${e.message}`, 'error');
      return;
    }

    try {
      log('=== Starting Workflow Execution ===');
      const job = await liteAPI.executeWorkflow(serializedGraph);
      let lastLen = 0;
      while (true) {
        const status = await liteAPI.getJob(job.id);
        if (status.log && status.log.length > lastLen) {
          const chunk = status.log.slice(lastLen);
          lastLen = status.log.length;
          chunk.split('\n').forEach(line => {
            if (line) log(line, 'info');
          });
        }
        if (status.status !== 'running' && status.status !== 'queued') {
          const result = status.result;
          if (result) {
            logWorkflowResult(result, log);
          } else if (status.error) {
            log(`✗ ${status.error}`, 'error');
          }
          log('=== Workflow Ended ===', status.status === 'done' ? 'success' : 'warning');
          break;
        }
        await new Promise(r => setTimeout(r, 400));
      }
    } catch (error) {
      log(`✗ Error: ${error.message}`, 'error');
      log('=== Workflow Ended (with errors) ===', 'error');
    }
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const serializedGraph = graph.serialize();
    const blob = new Blob([JSON.stringify(serializedGraph, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'workflow.json';
    a.click();
    URL.revokeObjectURL(a.href);
    log('Workflow downloaded as workflow.json', 'success');
  });

  const loadInput = document.getElementById('loadFileInput');
  document.getElementById('loadBtn').addEventListener('click', () => loadInput.click());
  loadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const workflowData = JSON.parse(await file.text());
      graph.clear();
      graph.configure(workflowData);
      canvas.setDirty(true);
      persistGraph(graph);
      log('Workflow loaded successfully', 'success');
      log(`Nodes: ${workflowData.nodes?.length || 0}, Links: ${workflowData.links?.length || 0}`, 'info');
    } catch (error) {
      log(`Error loading workflow: ${error.message}`, 'error');
    }
  });

  initPluginManagement();

  const addNodeBtn = document.getElementById('addNodeBtn');
  const nodeMenu = document.getElementById('nodeMenu');
  const nodeMenuList = document.getElementById('nodeMenuList');
  const nodeSearchInput = document.getElementById('nodeSearchInput');
  let allNodeTypes = [];

  function getAvailableNodeTypes() {
    const nodeTypes = [];
    if (LiteGraph.registered_node_types) {
      Object.keys(LiteGraph.registered_node_types).forEach(nodeType => {
        const nodeClass = LiteGraph.registered_node_types[nodeType];
        const title = nodeClass.title || nodeClass.name || nodeType;
        const category = nodeType.startsWith('plugin/') ? 'Plugin' :
                        nodeType.startsWith('input/') ? 'Input' : 'Other';
        nodeTypes.push({ type: nodeType, title, category });
      });
    }
    return nodeTypes.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.title.localeCompare(b.title);
    });
  }

  function renderNodeMenu(filter = '') {
    const filtered = filter.trim() === ''
      ? allNodeTypes
      : allNodeTypes.filter(node =>
          node.title.toLowerCase().includes(filter.toLowerCase()) ||
          node.type.toLowerCase().includes(filter.toLowerCase())
        );

    if (filtered.length === 0) {
      nodeMenuList.innerHTML = '<div class="node-menu-item" style="color: #888; cursor: default;">No nodes found</div>';
      return;
    }

    let currentCategory = '';
    let html = '';
    filtered.forEach(node => {
      if (node.category !== currentCategory) {
        currentCategory = node.category;
        html += `<div class="node-menu-item" style="color: #888; cursor: default; font-weight: bold;">${node.category}</div>`;
      }
      html += `
        <div class="node-menu-item" data-node-type="${node.type}">
          <div class="node-name">${node.title}</div>
        </div>
      `;
    });
    nodeMenuList.innerHTML = html;

    nodeMenuList.querySelectorAll('.node-menu-item[data-node-type]').forEach(item => {
      item.addEventListener('click', () => {
        addNodeToGraph(item.getAttribute('data-node-type'));
        nodeMenu.style.display = 'none';
        nodeSearchInput.value = '';
      });
    });
  }

  function addNodeToGraph(nodeType) {
    try {
      const node = LiteGraph.createNode(nodeType);
      if (!node) {
        log(`Failed to create node: ${nodeType}`, 'error');
        return;
      }
      let posX = 400;
      let posY = 300;
      if (graph._nodes && graph._nodes.length > 0) {
        const lastNode = graph._nodes[graph._nodes.length - 1];
        if (lastNode && lastNode.pos && Array.isArray(lastNode.pos) && lastNode.pos.length >= 2) {
          posX = lastNode.pos[0] + 250;
          posY = lastNode.pos[1] + 50;
        }
      }
      posX += (Math.random() - 0.5) * 100;
      posY += (Math.random() - 0.5) * 100;
      if (!node.pos) node.pos = [posX, posY];
      else {
        node.pos[0] = posX;
        node.pos[1] = posY;
      }
      graph.add(node);
      canvas.setDirty(true);
      persistGraph(graph);
      log(`Added node: ${node.title || nodeType}`, 'success');
    } catch (error) {
      log(`Error adding node: ${error.message}`, 'error');
    }
  }

  addNodeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (nodeMenu.style.display === 'none') {
      allNodeTypes = getAvailableNodeTypes();
      renderNodeMenu();
      nodeMenu.style.display = 'block';
      nodeSearchInput.focus();
    } else {
      nodeMenu.style.display = 'none';
      nodeSearchInput.value = '';
    }
  });
  nodeSearchInput.addEventListener('input', (e) => renderNodeMenu(e.target.value));
  document.addEventListener('click', (e) => {
    if (!addNodeBtn.contains(e.target) && !nodeMenu.contains(e.target)) {
      nodeMenu.style.display = 'none';
      nodeSearchInput.value = '';
    }
  });
  nodeSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      nodeMenu.style.display = 'none';
      nodeSearchInput.value = '';
    }
  });
}

function createDefaultGraph(graph) {
  const folderPicker = LiteGraph.createNode('input/folder_picker');
  folderPicker.pos = [40, 180];
  graph.add(folderPicker);

  const pluginTypes = Object.keys(LiteGraph.registered_node_types || {})
    .filter((t) => t.startsWith('plugin/'))
    .sort();

  const cols = 2;
  pluginTypes.forEach((type, i) => {
    const node = LiteGraph.createNode(type);
    if (!node) return;
    const col = i % cols;
    const row = Math.floor(i / cols);
    node.pos = [280 + col * 280, 20 + row * 150];
    graph.add(node);
    const slot = (node.inputs || []).findIndex((inp) => inp && inp.type === 'directory');
    folderPicker.connect(0, node, slot >= 0 ? slot : 0);
  });
}

function fitGraphToCanvas(canvas, graph) {
  const nodes = graph._nodes || [];
  if (!canvas || !nodes.length) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  nodes.forEach((n) => {
    const w = (n.size && n.size[0]) || 200;
    const h = (n.size && n.size[1]) || 100;
    minX = Math.min(minX, n.pos[0]);
    minY = Math.min(minY, n.pos[1]);
    maxX = Math.max(maxX, n.pos[0] + w);
    maxY = Math.max(maxY, n.pos[1] + h);
  });
  const padX = 40;
  const padTop = 160;
  const padBottom = 24;
  const viewW = canvas.canvas.width;
  const viewH = canvas.canvas.height;
  const scale = Math.min(viewW / (maxX - minX + padX * 2), viewH / (maxY - minY + padTop + padBottom), 1);
  canvas.ds.scale = scale;
  canvas.ds.offset = [padX - minX * scale, padTop - minY * scale];
  canvas.setDirty(true, true);
}

function applyPickedFolder(graph) {
  const folder = sessionStorage.getItem('lite.pickedFolder');
  if (!folder) return;
  sessionStorage.removeItem('lite.pickedFolder');
  const nodeId = sessionStorage.getItem('lite.pickNodeId');
  sessionStorage.removeItem('lite.pickNodeId');
  const nodes = graph._nodes || [];
  let node = null;
  if (nodeId) {
    node = nodes.find(n => String(n.id) === String(nodeId));
  }
  if (!node) {
    node = nodes.find(n => n.type === 'input/folder_picker');
  }
  if (!node) return;
  node.properties.folder = folder;
  if (node.folderLabelWidget) {
    const parts = folder.split(/[/\\]/);
    node.folderLabelWidget.value = parts[parts.length - 1] || folder;
  }
  node.setDirtyCanvas(true);
}

function logWorkflowResult(result, log) {
  if (result.executionDir) log(`Execution directory: ${result.executionDir}`);
  if (result.results && result.results.length > 0) {
    result.results.forEach(nodeResult => {
      log(`\n--- Node ${nodeResult.nodeId} (${nodeResult.nodeType || 'unknown'}) ---`);
      if (nodeResult.command) log(`Command: ${nodeResult.command}`, 'info');
      log(`Status: ${nodeResult.success ? '✓ Success' : '✗ Failed'}`, nodeResult.success ? 'success' : 'error');
      if (nodeResult.duration !== undefined) {
        log(`Duration: ${(nodeResult.duration / 1000).toFixed(2)}s`, 'info');
      }
      if (nodeResult.outputDir) log(`Output directory: ${nodeResult.outputDir}`);
      if (nodeResult.output) log(`Output:\n${nodeResult.output}`, nodeResult.success ? 'info' : 'error');
    });
  }
  if (result.errors && result.errors.length > 0) {
    log('\n=== Errors ===', 'error');
    result.errors.forEach(error => log(`✗ ${error}`, 'error'));
  }
  if (result.timing) {
    log('\n=== Execution Statistics ===', 'info');
    const totalSeconds = (result.timing.totalDuration / 1000).toFixed(2);
    log(`Total Workflow Duration: ${totalSeconds}s`, 'success');
  }
  log(`\n=== ${result.summary || 'Workflow execution completed'} ===`, result.success !== false ? 'success' : 'info');
}

runApp();
