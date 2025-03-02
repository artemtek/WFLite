import { createLiteGraphNodeFromJSON } from "./scripts/lite-to-lg.js";

async function runApp() {

  const plugins = await window.electronAPI.loadPlugins()
  plugins.forEach(plugin => createLiteGraphNodeFromJSON(plugin));

  // Create graph
  const graph = new LGraph();

  // Create canvas
  const canvas = new LGraphCanvas("#mycanvas", graph);


  const node_const = LiteGraph.createNode("plugin/simple-converter-plugin");
  node_const.pos = [200, 200];
  graph.add(node_const);
  // node_const.setValue("echo 'Hello World'");
  // node_const.connect(0, node_watch, 0);

  // Set size to match window
  function resizeCanvas() {
    const canvas = document.getElementById('mycanvas');
    canvas.width = window.innerWidth * 0.7; // 70% of window width
    canvas.height = window.innerHeight;
  }

  // Initial size
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
    // Get the string node's value
    const ser = graph.serialize();
    const nodes = ser.nodes;
    const mainNode = nodes[0];
    const command = mainNode.properties.value;

    try {
      const result = await window.electronAPI.executeCommand(command);
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
