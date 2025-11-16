import { spawn } from 'child_process';
import { 
    createWorkflowExecutionDir, 
    resolveNodeInputs, 
    buildDockerCommand,
    ensureNodeOutputDir
} from './workflow-execution.js';
import { loadPluginsHandler } from './load-plugins.js';

// Graph sequencing functions (for main process)
function simplifyGraph(graph) {
    const simpleNodes = graph.nodes.map((n) => ({ id: n.id, in: [], out: [] }));
    const sourceNodeIdArrayIndex = 1;
    const targetNodeIdArrayIndex = 3;

    for (const link of graph.links || []) {
        const sourceNode = simpleNodes.find((n) => n.id === link[sourceNodeIdArrayIndex]);
        const targetNode = simpleNodes.find((n) => n.id === link[targetNodeIdArrayIndex]);

        if (sourceNode && targetNode) {
            if (sourceNode.out.includes(targetNode.id)) {
                continue;
            }
            sourceNode.out.push(targetNode.id);
            targetNode.in.push(sourceNode.id);
        }
    }

    return simpleNodes;
}

function getSequence(simpleNodes) {
    const allNodes = simpleNodes.slice();
    const startNodes = allNodes.filter((n) => n.in.length === 0);

    if (startNodes.length === 0) {
        throw new Error('No start node found');
    }

    const nextNodes = startNodes;
    const sequence = [];
    const visitedNodes = new Set();

    while (nextNodes.length > 0) {
        const node = nextNodes.shift();
        if (node) {
            sequence.push(node.id);
            visitedNodes.add(node.id);
            const nextNodeIds = node.out;
            for (const nextNodeId of nextNodeIds) {
                const nextNode = simpleNodes.find((n) => n.id === nextNodeId);
                if (nextNode) {
                    if (nextNode.in.every((n) => visitedNodes.has(n))) {
                        nextNodes.push(nextNode);
                    }
                }
            }
        }
    }

    return sequence;
}

export const executeWorkflowHandler = async (event, workflow) => {
    if (!workflow) {
        throw new Error('Workflow is required');
    }

    try {
        // Create execution directory (persistent, cross-platform)
        const workflowName = workflow.name || null;
        const execDir = await createWorkflowExecutionDir(workflowName);
        console.log('Created execution directory:', execDir);

        // Load plugin definitions
        const plugins = await loadPluginsHandler();
        const pluginMap = new Map(plugins.map(p => [`plugin/${p.id}`, p]));

        // Get execution sequence
        const simplifiedGraph = simplifyGraph(workflow);
        const sequence = getSequence(simplifiedGraph);
        const sequencedNodes = sequence.map(id => workflow.nodes.find(n => n.id === id));

        const results = [];
        const errors = [];

        // Execute nodes in sequence
        for (const node of sequencedNodes) {
            try {
                console.log(`Executing node ${node.id} (${node.type})`);

                // Skip input nodes (like Folder Picker) - they don't execute commands
                if (node.type && node.type.startsWith('input/')) {
                    console.log(`Skipping input node ${node.id}`);
                    continue;
                }

                // Get plugin definition for this node
                const pluginDef = pluginMap.get(node.type);
                if (!pluginDef) {
                    throw new Error(`Plugin definition not found for node type: ${node.type}`);
                }

                // Ensure output directory exists
                await ensureNodeOutputDir(execDir, node.id);

                // Resolve inputs for this node
                const inputs = resolveNodeInputs(node, workflow, execDir);

                // Build Docker command
                const { program, args, outputDir } = buildDockerCommand(node, inputs, execDir, pluginDef);

                // Execute command
                const result = await executeCommand(program, args, execDir);
                results.push({
                    nodeId: node.id,
                    nodeType: node.type,
                    success: result.success,
                    output: result.output,
                    outputDir: outputDir
                });

                if (!result.success) {
                    errors.push(`Node ${node.id} failed: ${result.output}`);
                }
            } catch (error) {
                errors.push(`Node ${node.id} error: ${error.message}`);
                results.push({
                    nodeId: node.id,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            success: errors.length === 0,
            executionDir: execDir,
            results: results,
            errors: errors,
            summary: `${results.length} nodes executed, ${errors.length} errors`
        };
    } catch (error) {
        throw new Error(`Workflow execution failed: ${error.message}`);
    }
}

function executeCommand(program, args, execDir) {
    return new Promise((resolve, reject) => {
        console.log('Executing:', program, args.join(' '));

        const process = spawn(program, args, {
            cwd: execDir,
            stdio: ['inherit', 'pipe', 'pipe']
        });

        let output = '';
        let error = '';

        process.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            console.log('STDOUT:', text);
        });

        process.stderr.on('data', (data) => {
            const text = data.toString();
            error += text;
            console.error('STDERR:', text);
        });

        process.on('close', (code) => {
            resolve({
                success: code === 0,
                output: output || error,
                code: code
            });
        });

        process.on('error', (err) => {
            reject({
                success: false,
                error: err.message,
                code: 1
            });
        });
    });
}