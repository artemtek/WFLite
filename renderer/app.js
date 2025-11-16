import { lite2lg } from "./scripts/lite-to-lg.js";
import { getSequence, simplifyGraph } from "./scripts/compile-graph.js";

async function runApp() {

  // Load and register node types
  const plugins = await window.electronAPI.loadPlugins();
  plugins.forEach(plugin => {
    const nodeClass = lite2lg(plugin);
    LiteGraph.registerNodeType("plugin/" + nodeClass.id, nodeClass);
  });

  // Create graph and canvas
  const graph = new LGraph();
  const canvas = new LGraphCanvas("#mycanvas", graph);

  // Create another temp node for dev
  const node1 = LiteGraph.createNode('plugin/simple-converter-plugin');
  node1.pos = [100, 100];
  graph.add(node1);

  const node2 = LiteGraph.createNode('plugin/simple-converter-plugin');
  node2.pos = [500, 100];
  graph.add(node2);

  node1.connect(0, node2, 0);




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
      log(`Executing: ${command}`);
      log(result.output);
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
