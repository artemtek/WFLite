// Create graph
const graph = new LGraph();

// Create canvas
const canvas = new LGraphCanvas("#mycanvas", graph);

// Create nodes
// const node_tttsub = LiteGraph.createNode("basic/tttsub");
// node_tttsub.pos = [200, 100];
// graph.add(node_tttsub);


const node_const = LiteGraph.createNode("basic/string");
node_const.pos = [200, 200];
graph.add(node_const);
node_const.setValue("echo 'Hello World'");

// const node_watch = LiteGraph.createNode("basic/watch");
// node_watch.pos = [700, 200];
// graph.add(node_watch);

// node_const.connect(0, node_watch, 0);

// list all nodes types
console.log(LiteGraph);

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

// Start rendering
// graph.start();

// Example logging function
function log(message) {
  const logArea = document.getElementById('log');
  logArea.value += `\n${message}\n>`;
  logArea.scrollTop = logArea.scrollHeight;
}

// Get command execution button
const executeBtn = document.getElementById('executeBtn');

// Handle button click
executeBtn.addEventListener('click', async () => {
  // Get the string node's value
  const ser = graph.serialize();
  const nodes = ser.nodes;
  const mainNode = nodes[0];
  const command = mainNode.properties.value;

  console.log(command);

  try {
    // Execute the command via IPC
    const result = await window.electronAPI.executeCommand(command);
    log(`Executing: ${command}`);
    log(result.output);
  } catch (error) {
    log(`Error: ${error.message}`);
  }
}); 