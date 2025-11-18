import { lite2lg } from "./scripts/lite-to-lg.js";
import { getSequence, simplifyGraph } from "./scripts/compile-graph.js";
import { initPluginManagement } from "./scripts/plugin-management.js";

async function runApp() {

  // Clear ALL OEM/default node types by replacing the registry
  // Keep only custom nodes (plugin/* and specific input/* nodes we want)
  if (LiteGraph.registered_node_types) {
    const customNodes = {};
    const allowedInputNodes = ['input/folder_picker']; // Only keep these input nodes
    Object.keys(LiteGraph.registered_node_types).forEach(nodeTypeName => {
      if (nodeTypeName.startsWith('plugin/')) {
        customNodes[nodeTypeName] = LiteGraph.registered_node_types[nodeTypeName];
      } else if (allowedInputNodes.includes(nodeTypeName)) {
        customNodes[nodeTypeName] = LiteGraph.registered_node_types[nodeTypeName];
      }
      // Explicitly exclude Gamepad and other default nodes
    });
    LiteGraph.registered_node_types = customNodes;
  }

  // Function to reload plugins
  async function reloadPlugins() {
    try {
      const plugins = await window.electronAPI.loadPlugins();
      plugins.forEach(plugin => {
        const nodeClass = lite2lg(plugin);
        LiteGraph.registerNodeType("plugin/" + nodeClass.id, nodeClass);
      });
      log(`Loaded ${plugins.length} plugin(s)`, 'success');
    } catch (error) {
      log(`Error loading plugins: ${error.message}`, 'error');
    }
  }
  
  // Load and register node types
  await reloadPlugins();
  
  // Make reloadPlugins available globally
  window.reloadPlugins = reloadPlugins;

  // Globally remove "Mode", "Properties", and "Resize" options from context menu
  // Override getNodeMenuOptions on LGraphCanvas prototype
  const originalGetNodeMenuOptions = LGraphCanvas.prototype.getNodeMenuOptions;
  LGraphCanvas.prototype.getNodeMenuOptions = function(node) {
    // Call the original method to get the default options
    const options = originalGetNodeMenuOptions ? originalGetNodeMenuOptions.call(this, node) : [];
    
    // Options to remove
    const optionsToRemove = ['Mode', 'Properties', 'Resize'];
    
    // Filter out the unwanted options
    return options.filter(option => {
      if (typeof option === 'string') {
        return !optionsToRemove.includes(option);
      }
      if (option && typeof option === 'object') {
        // Handle object options - check various possible properties
        const optionValue = option.content || option.text || option.title || option;
        return !optionsToRemove.includes(optionValue);
      }
      return true;
    });
  };

  // Create graph and canvas
  const graph = new LGraph();
  const canvas = new LGraphCanvas("#mycanvas", graph);

  // Create startup workflow: Folder Picker -> Copy Plugin
  const folderPicker = LiteGraph.createNode('input/folder_picker');
  folderPicker.pos = [100, 100];
  graph.add(folderPicker);

  const copyPlugin = LiteGraph.createNode('plugin/artemtek-copy');
  copyPlugin.pos = [400, 100];
  graph.add(copyPlugin);

  // Connect Folder Picker output to Copy Plugin input directory
  folderPicker.connect(0, copyPlugin, 0);




  // Create example node (temp)
  // const node_const = LiteGraph.createNode("plugin/echo-example");
  // node_const.pos = [200, 200];
  // graph.add(node_const);
  // node_const.setValue("echo 'Hello World'");
  // node_const.connect(0, node_watch, 0);

  // Set size to match window
  function resizeCanvas() {
    const canvas = document.getElementById('mycanvas');
    canvas.width = window.innerWidth * 0.7; // 70% of window width
    canvas.height = window.innerHeight;
  }

  // Initial resize
  resizeCanvas();

  // Handle window resizing
  window.addEventListener('resize', resizeCanvas);

  // Logging function with color support
  function log(message, type = 'info') {
    const logArea = document.getElementById('log');
    const colorClass = type === 'error' ? 'error' : 
                      type === 'success' ? 'success' : 
                      type === 'warning' ? 'warning' : 'info';
    
    // Escape HTML to prevent XSS
    const escapedMessage = message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    const coloredMessage = `<span class="${colorClass}">${escapedMessage}</span>`;
    logArea.innerHTML += `\n${coloredMessage}\n>`;
    logArea.scrollTop = logArea.scrollHeight;
  }

  
  // Button: Stop Workflow
  const stopBtn = document.getElementById('stopBtn');
  stopBtn.addEventListener('click', async () => {
    try {
      log('=== Stopping Workflow ===', 'warning');
      const result = await window.electronAPI.killWorkflowProcesses();
      if (result.success) {
        log(`✓ ${result.message}`, 'success');
      } else {
        log(`✗ Failed to stop workflow: ${result.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      log(`✗ Error stopping workflow: ${error.message}`, 'error');
    }
  });

  // Button: Execute command
  const executeBtn = document.getElementById('executeBtn');
  executeBtn.addEventListener('click', async () => {
    const serializedGraph = graph.serialize();
    console.log(0, "graph", serializedGraph);

    const simplifiedGraph = simplifyGraph(serializedGraph);
    console.log('simplifiedGraph', simplifiedGraph)

    const sequnecedGraphIds = getSequence(simplifiedGraph);
    console.log('sequnecedGraphIds', sequnecedGraphIds);

    const sequnecedGraph = sequnecedGraphIds.map(id => serializedGraph.nodes.find(node => node.id === id));
    console.log('sequnecedGraph', sequnecedGraph);
  

    try {
      log('=== Starting Workflow Execution ===');
      const result = await window.electronAPI.executeWorkflow(serializedGraph);
      
      if (result.executionDir) {
        log(`Execution directory: ${result.executionDir}`);
      }
      
      if (result.results && result.results.length > 0) {
        result.results.forEach(nodeResult => {
          log(`\n--- Node ${nodeResult.nodeId} (${nodeResult.nodeType || 'unknown'}) ---`);
          if (nodeResult.command) {
            log(`Command: ${nodeResult.command}`, 'info');
          }
          log(`Status: ${nodeResult.success ? '✓ Success' : '✗ Failed'}`, nodeResult.success ? 'success' : 'error');
          if (nodeResult.duration !== undefined) {
            const durationSeconds = (nodeResult.duration / 1000).toFixed(2);
            log(`Duration: ${durationSeconds}s`, 'info');
          }
          if (nodeResult.outputDir) {
            log(`Output directory: ${nodeResult.outputDir}`);
          }
          if (nodeResult.output) {
            log(`Output:\n${nodeResult.output}`, nodeResult.success ? 'info' : 'error');
          }
        });
      }
      
      if (result.errors && result.errors.length > 0) {
        log('\n=== Errors ===', 'error');
        result.errors.forEach(error => log(`✗ ${error}`, 'error'));
      }
      
      // Display timing statistics
      if (result.timing) {
        log('\n=== Execution Statistics ===', 'info');
        const totalSeconds = (result.timing.totalDuration / 1000).toFixed(2);
        const totalMinutes = Math.floor(result.timing.totalDuration / 60000);
        const totalSecondsRemainder = ((result.timing.totalDuration % 60000) / 1000).toFixed(2);
        
        if (totalMinutes > 0) {
          log(`Total Workflow Duration: ${totalMinutes}m ${totalSecondsRemainder}s`, 'success');
        } else {
          log(`Total Workflow Duration: ${totalSeconds}s`, 'success');
        }
        
        if (result.timing.nodeTimings && result.timing.nodeTimings.length > 0) {
          log('\nNode Execution Times:', 'info');
          result.timing.nodeTimings.forEach(timing => {
            const nodeSeconds = (timing.duration / 1000).toFixed(2);
            const nodeTypeDisplay = timing.nodeType ? timing.nodeType.replace('plugin/', '') : 'unknown';
            log(`  • Node ${timing.nodeId} (${nodeTypeDisplay}): ${nodeSeconds}s`, 'info');
          });
        }
      }
      
      log(`\n=== ${result.summary || 'Workflow execution completed'} ===`, result.success !== false ? 'success' : 'info');
      log('=== Workflow Ended ===', result.success !== false ? 'success' : 'warning');
    } catch (error) {
      log(`✗ Error: ${error.message}`, 'error');
      log('=== Workflow Ended (with errors) ===', 'error');
    }
  });



  // Button: Save
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.addEventListener('click', async () => {
    try {
      const serializedGraph = graph.serialize();
      const filePath = await window.electronAPI.dialogSaveFile(serializedGraph);
      if (filePath) {
        log(`Workflow saved to: ${filePath}`, 'success');
      }
    } catch (error) {
      log(`Error saving workflow: ${error.message}`, 'error');
    }
  });

  // Button: Load
  const loadBtn = document.getElementById('loadBtn');
  loadBtn.addEventListener('click', async () => {
    try {
      const workflowData = await window.electronAPI.dialogOpenFile();
      if (workflowData) {
        // Clear current graph
        graph.clear();
        
        // Configure graph with loaded data
        graph.configure(workflowData);
        
        // Refresh canvas
        canvas.setDirty(true);
        
        log(`Workflow loaded successfully`, 'success');
        log(`Nodes: ${workflowData.nodes?.length || 0}, Links: ${workflowData.links?.length || 0}`, 'info');
      }
    } catch (error) {
      log(`Error loading workflow: ${error.message}`, 'error');
    }
  });

  // Initialize plugin management
  initPluginManagement();
  
  // Make log function available globally for plugin management
  window.log = log;

  // Add Node functionality
  const addNodeBtn = document.getElementById('addNodeBtn');
  const nodeMenu = document.getElementById('nodeMenu');
  const nodeMenuList = document.getElementById('nodeMenuList');
  const nodeSearchInput = document.getElementById('nodeSearchInput');
  let allNodeTypes = [];

  // Function to get all available node types
  function getAvailableNodeTypes() {
    const nodeTypes = [];
    if (LiteGraph.registered_node_types) {
      Object.keys(LiteGraph.registered_node_types).forEach(nodeType => {
        const nodeClass = LiteGraph.registered_node_types[nodeType];
        const title = nodeClass.title || nodeClass.name || nodeType;
        const category = nodeType.startsWith('plugin/') ? 'Plugin' : 
                        nodeType.startsWith('input/') ? 'Input' : 'Other';
        nodeTypes.push({
          type: nodeType,
          title: title,
          category: category
        });
      });
    }
    // Sort by category, then by title
    return nodeTypes.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.title.localeCompare(b.title);
    });
  }

  // Function to render node menu
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
        if (currentCategory !== '') {
          html += '</div>';
        }
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

    // Add click handlers
    nodeMenuList.querySelectorAll('.node-menu-item[data-node-type]').forEach(item => {
      item.addEventListener('click', () => {
        const nodeType = item.getAttribute('data-node-type');
        addNodeToGraph(nodeType);
        nodeMenu.style.display = 'none';
        nodeSearchInput.value = '';
      });
    });
  }

  // Function to add node to graph
  function addNodeToGraph(nodeType) {
    try {
      const node = LiteGraph.createNode(nodeType);
      if (!node) {
        log(`Failed to create node: ${nodeType}`, 'error');
        return;
      }

      // Position node - use a simple approach
      // Get existing nodes to find a good position, or use default center
      let posX = 400;
      let posY = 300;
      
      // If there are existing nodes, place new node near the last one
      if (graph._nodes && graph._nodes.length > 0) {
        const lastNode = graph._nodes[graph._nodes.length - 1];
        if (lastNode && lastNode.pos && Array.isArray(lastNode.pos) && lastNode.pos.length >= 2) {
          posX = lastNode.pos[0] + 250;
          posY = lastNode.pos[1] + 50;
        }
      }
      
      // Add some random offset to avoid exact stacking
      posX += (Math.random() - 0.5) * 100;
      posY += (Math.random() - 0.5) * 100;
      
      // Set position before adding to graph
      if (!node.pos) {
        node.pos = [posX, posY];
      } else {
        node.pos[0] = posX;
        node.pos[1] = posY;
      }
      
      graph.add(node);
      canvas.setDirty(true);
      
      log(`Added node: ${node.title || nodeType}`, 'success');
    } catch (error) {
      log(`Error adding node: ${error.message}`, 'error');
      console.error('Full error:', error);
    }
  }

  // Toggle node menu
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

  // Search filter
  nodeSearchInput.addEventListener('input', (e) => {
    renderNodeMenu(e.target.value);
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!addNodeBtn.contains(e.target) && !nodeMenu.contains(e.target)) {
      nodeMenu.style.display = 'none';
      nodeSearchInput.value = '';
    }
  });

  // Close menu on Escape key
  nodeSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      nodeMenu.style.display = 'none';
      nodeSearchInput.value = '';
    }
  });

  // Make graph and canvas available globally for node menu
  window.graph = graph;
  window.canvas = canvas;

}

runApp();
