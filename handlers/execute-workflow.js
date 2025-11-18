import { spawn } from 'child_process';
import process from 'process';
import { 
    createWorkflowExecutionDir, 
    resolveNodeInputs, 
    buildDockerCommand,
    ensureNodeOutputDir
} from './workflow-execution.js';
import { loadPluginsHandler } from './load-plugins.js';

// Track active processes for workflow execution
const activeProcesses = new Set();

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

    // Track total workflow execution time
    const workflowStartTime = Date.now();

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
            const nodeStartTime = Date.now();
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

                // Format command for logging
                const commandString = `${program} ${args.join(' ')}`;
                
                // Execute command
                const result = await executeCommand(program, args, execDir);
                
                const nodeEndTime = Date.now();
                const nodeDuration = nodeEndTime - nodeStartTime;
                
                results.push({
                    nodeId: node.id,
                    nodeType: node.type,
                    success: result.success,
                    output: result.output,
                    outputDir: outputDir,
                    command: commandString,
                    duration: nodeDuration
                });

                if (!result.success) {
                    errors.push(`Node ${node.id} failed: ${result.output}`);
                }
            } catch (error) {
                const nodeEndTime = Date.now();
                const nodeDuration = nodeEndTime - nodeStartTime;
                errors.push(`Node ${node.id} error: ${error.message}`);
                results.push({
                    nodeId: node.id,
                    success: false,
                    error: error.message,
                    duration: nodeDuration
                });
            }
        }

        const workflowEndTime = Date.now();
        const totalDuration = workflowEndTime - workflowStartTime;

        return {
            success: errors.length === 0,
            executionDir: execDir,
            results: results,
            errors: errors,
            summary: `${results.length} nodes executed, ${errors.length} errors`,
            timing: {
                totalDuration: totalDuration,
                nodeTimings: results.map(r => ({
                    nodeId: r.nodeId,
                    nodeType: r.nodeType,
                    duration: r.duration || 0
                }))
            }
        };
    } catch (error) {
        const workflowEndTime = Date.now();
        const totalDuration = workflowEndTime - workflowStartTime;
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

        // Track this process
        activeProcesses.add(process);

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
            // Remove from active processes
            activeProcesses.delete(process);
            resolve({
                success: code === 0,
                output: output || error,
                code: code
            });
        });

        process.on('error', (err) => {
            // Remove from active processes
            activeProcesses.delete(process);
            reject({
                success: false,
                error: err.message,
                code: 1
            });
        });
    });
}

// Kill all active workflow processes
export const killWorkflowProcessesHandler = async () => {
    const killedCount = activeProcesses.size;
    
    // Kill all tracked processes
    activeProcesses.forEach(childProcess => {
        try {
            // Kill the process and its children
            if (childProcess.pid) {
                // On Unix systems, kill the process group
                if (process.platform !== 'win32') {
                    childProcess.kill('SIGTERM');
                    // Force kill after a short delay if needed
                    setTimeout(() => {
                        if (!childProcess.killed) {
                            childProcess.kill('SIGKILL');
                        }
                    }, 1000);
                } else {
                    // Windows
                    childProcess.kill();
                }
            }
        } catch (error) {
            console.error('Error killing process:', error);
        }
    });
    
    // Clear the set
    activeProcesses.clear();
    
    // Also try to kill any Docker containers that might be running
    try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        // Kill all running Docker containers (cross-platform)
        try {
            // First, get list of running container IDs
            const { stdout: containerIds } = await execAsync('docker ps -q', { timeout: 3000 });
            if (containerIds && containerIds.trim()) {
                // Kill each container
                const ids = containerIds.trim().split('\n').filter(id => id);
                for (const id of ids) {
                    try {
                        await execAsync(`docker kill ${id}`, { timeout: 2000 });
                    } catch (error) {
                        // Ignore individual container kill errors
                        console.log(`Note: Could not kill container ${id}:`, error.message);
                    }
                }
            }
        } catch (error) {
            // Ignore errors - containers might not exist or command might fail
            console.log('Note: Could not kill Docker containers:', error.message);
        }
    } catch (error) {
        console.log('Note: Could not execute Docker kill command:', error.message);
    }
    
    return {
        success: true,
        killedCount: killedCount,
        message: `Killed ${killedCount} process(es)`
    };
};