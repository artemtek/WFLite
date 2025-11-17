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
      
      log(`\n=== ${result.summary || 'Workflow execution completed'} ===`, result.success !== false ? 'success' : 'info');
    } catch (error) {
      log(`✗ Error: ${error.message}`, 'error');
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


}

runApp();
