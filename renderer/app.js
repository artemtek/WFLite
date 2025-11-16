import { lite2lg } from "./scripts/lite-to-lg.js";
import { getSequence, simplifyGraph } from "./scripts/compile-graph.js";

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

  // Load and register node types
  const plugins = await window.electronAPI.loadPlugins();
  plugins.forEach(plugin => {
    const nodeClass = lite2lg(plugin);
    LiteGraph.registerNodeType("plugin/" + nodeClass.id, nodeClass);
  });

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

  // Example logging function
  function log(message) {
    const logArea = document.getElementById('log');
    logArea.value += `\n${message}\n>`;
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
      const result = await window.electronAPI.executeWorkflow(serializedGraph);
      log(result.summary || 'Workflow execution completed');
      if (result.executionDir) {
        log(`Execution directory: ${result.executionDir}`);
      }
      if (result.results && result.results.length > 0) {
        result.results.forEach(nodeResult => {
          log(`Node ${nodeResult.nodeId}: ${nodeResult.success ? 'Success' : 'Failed'}`);
          if (nodeResult.outputDir) {
            log(`  Output: ${nodeResult.outputDir}`);
          }
        });
      }
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => log(`Error: ${error}`));
      }
    } catch (error) {
      log(`Error: ${error.message}`);
    }
  });



  // Button: Save
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.addEventListener('click', async () => {
    const ser = graph.serialize();
    await window.electronAPI.dialogSaveFile(ser);
  });



  // Button: Load
  const loadBtn = document.getElementById('loadBtn');
  loadBtn.addEventListener('click', async () => {
    const file = await window.electronAPI.dialogOpenFile();
    if (file) {

      graph.clear();
      graph.configure(file);
    }
  });


}

runApp();
