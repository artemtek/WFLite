import { mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

/**
 * Gets the base directory for workflow outputs (cross-platform)
 * @param {string} customBase - Optional custom base directory
 * @returns {string} Base directory path
 */
export function getWorkflowBaseDir(customBase = null) {
    if (customBase) {
        return customBase;
    }
    // Cross-platform home directory
    return join(homedir(), 'lite-workflows');
}

/**
 * Creates a workflow execution directory structure
 * @param {string} workflowName - Name of the workflow (optional)
 * @param {string} customBase - Custom base directory (optional)
 * @returns {Promise<string>} Path to the execution directory
 */
export async function createWorkflowExecutionDir(workflowName = null, customBase = null) {
    const baseDir = getWorkflowBaseDir(customBase);
    const timestamp = Date.now();
    const randomId = randomUUID().slice(0, 8);
    
    // Create execution ID: timestamp-workflowname-random or timestamp-random
    const executionId = workflowName 
        ? `${timestamp}-${workflowName.replace(/[^a-zA-Z0-9-_]/g, '_')}-${randomId}`
        : `${timestamp}-${randomId}`;
    
    const execDir = join(baseDir, executionId);
    
    // Create execution directory
    await mkdir(execDir, { recursive: true });
    
    return execDir;
}

/**
 * Gets the output directory for a specific node
 * @param {string} execDir - Execution directory
 * @param {number} nodeId - Node ID
 * @returns {string} Node output directory path
 */
export function getNodeOutputDir(execDir, nodeId) {
    return join(execDir, `node-${nodeId}`);
}

/**
 * Ensures a node's output directory exists
 * @param {string} execDir - Execution directory
 * @param {number} nodeId - Node ID
 * @returns {Promise<string>} Node output directory path
 */
export async function ensureNodeOutputDir(execDir, nodeId) {
    const outputDir = getNodeOutputDir(execDir, nodeId);
    await mkdir(outputDir, { recursive: true });
    return outputDir;
}

/**
 * Resolves input paths for a node based on graph connections
 * @param {Object} node - The node from the graph
 * @param {Object} graph - The full graph with links and nodes
 * @param {string} execDir - Execution directory
 * @returns {Object} Map of input slot index to resolved path
 */
export function resolveNodeInputs(node, graph, execDir) {
    const inputs = {};
    const nodeId = node.id;
    
    // Find all links that connect TO this node
    const incomingLinks = (graph.links || []).filter(link => {
        // link format: [linkId, sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex, type]
        return link[3] === nodeId; // targetNodeId matches this node
    });
    
    incomingLinks.forEach(link => {
        const sourceNodeId = link[1];
        const targetInputIndex = link[4];
        
        // Find the source node
        const sourceNode = graph.nodes.find(n => n.id === sourceNodeId);
        if (!sourceNode) return;
        
        // Determine the input path
        if (sourceNode.type === 'input/folder_picker') {
            // Folder Picker: use the selected folder path directly
            const folderPath = sourceNode.properties?.folder || '';
            if (folderPath) {
                inputs[targetInputIndex] = folderPath;
            }
        } else {
            // Regular node: use the node's output directory
            const outputPath = getNodeOutputDir(execDir, sourceNodeId);
            inputs[targetInputIndex] = outputPath;
        }
    });
    
    return inputs;
}

/**
 * Builds Docker command with volume mounts for a node
 * @param {Object} node - The node to execute
 * @param {Object} inputs - Resolved input paths (inputIndex -> path)
 * @param {string} execDir - Execution directory
 * @param {Object} pluginDef - Plugin definition from JSON
 * @returns {Object} { program, args, outputDir }
 */
export function buildDockerCommand(node, inputs, execDir, pluginDef) {
    const nodeId = node.id;
    const outputDir = getNodeOutputDir(execDir, nodeId);
    
    // Docker command args
    const dockerArgs = ['run', '--rm'];
    
    // Add volume mounts for inputs
    Object.entries(inputs).forEach(([inputIndex, inputPath]) => {
        // Find the input definition to get the input name/id
        const inputDef = pluginDef.inputs?.find((inp, idx) => {
            // This is a simplification - you may need to map inputIndex to actual input
            // For now, we'll use the input index as the mount point name
            return idx === parseInt(inputIndex);
        });
        
        if (inputDef) {
            const mountPoint = `/input/${inputDef.id}`;
            dockerArgs.push('-v', `${inputPath}:${mountPoint}`);
        } else {
            // Fallback: use index-based mount point
            const mountPoint = `/input/${inputIndex}`;
            dockerArgs.push('-v', `${inputPath}:${mountPoint}`);
        }
    });
    
    // Mount output directory
    dockerArgs.push('-v', `${outputDir}:/output`);
    
    // Add Docker image (assuming it's in the command args)
    const imageIndex = pluginDef.command?.args?.findIndex(arg => 
        arg.includes(':') || arg.includes('/')
    ) || 2; // Default to index 2 if not found
    
    const image = pluginDef.command?.args?.[imageIndex] || 'image:latest';
    dockerArgs.push(image);
    
    // Build command args with placeholder replacement
    const commandArgs = (pluginDef.command?.args || []).slice(imageIndex + 1);
    
    const resolvedArgs = commandArgs.map(arg => {
        let resolved = String(arg);
        
        // Replace input placeholders
        Object.entries(inputs).forEach(([inputIndex, inputPath]) => {
            const inputDef = pluginDef.inputs?.find((inp, idx) => idx === parseInt(inputIndex));
            if (inputDef) {
                const placeholder = `{${inputDef.id}}`;
                const containerPath = `/input/${inputDef.id}`;
                resolved = resolved.replace(placeholder, containerPath);
            }
        });
        
        // Replace output placeholders
        if (pluginDef.outputs) {
            pluginDef.outputs.forEach(output => {
                const placeholder = `{${output.id}}`;
                resolved = resolved.replace(placeholder, '/output');
            });
        }
        
        // Replace property placeholders
        Object.entries(node.properties || {}).forEach(([key, value]) => {
            const placeholder = `{${key}}`;
            resolved = resolved.replace(placeholder, String(value));
        });
        
        return resolved;
    });
    
    dockerArgs.push(...resolvedArgs);
    
    return {
        program: pluginDef.command?.program || 'docker',
        args: dockerArgs,
        outputDir: outputDir
    };
}

