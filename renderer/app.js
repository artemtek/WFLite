async function runApp() {

  const plugins = await window.electronAPI.loadPlugins()
  plugins.forEach(plugin => createLiteGraphNodeFromJSON(plugin));

  // Create graph
  const graph = new LGraph();

  // Create canvas
  const canvas = new LGraphCanvas("#mycanvas", graph);


  // Create nodes
  // const node_tttsub = LiteGraph.createNode("basic/tttsub");
  // node_tttsub.pos = [200, 100];
  // graph.add(node_tttsub);


  const node_const = LiteGraph.createNode("plugin/simple-converter-plugin");
  node_const.pos = [200, 200];
  graph.add(node_const);
  // node_const.setValue("echo 'Hello World'");

  // const node_watch = LiteGraph.createNode("basic/watch");
  // node_watch.pos = [700, 200];
  // graph.add(node_watch);

  // node_const.connect(0, node_watch, 0);

  // list all nodes types
  // console.log(LiteGraph);

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

  // // Button to dynamically add a node type
  // const addNodeBtn = document.getElementById('addNodeBtn');
  // addNodeBtn.addEventListener('click', () => {
  //   function MyAddNode() {
  //     this.addInput("A", "number");
  //     this.addInput("B", "number");
  //     this.addOutput("A+B", "number");
  //     this.properties = { precision: 1 };
  //   }

  //   //name to show
  //   MyAddNode.title = "tttsub";

  //   //function to call when the node is executed
  //   MyAddNode.prototype.onExecute = function () {
  //     console.log("onExecute");
  //     let A = this.getInputData(0);
  //     if (A === undefined)
  //       A = 0;
  //     let B = this.getInputData(1);
  //     if (B === undefined)
  //       B = 0;
  //     this.setOutputData(0, A + B);
  //   }

  //   // //register in the system
  //   LiteGraph.registerNodeType("basic/tttsub", MyAddNode);

  //   console.log("Node added");
  // });




  // Button to execute the command
  const executeBtn = document.getElementById('executeBtn');
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

}

runApp();
