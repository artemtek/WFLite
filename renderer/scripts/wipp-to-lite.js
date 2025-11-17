/**
 * Convert WIPP (Web Image Processing Pipeline) format to LITE plugin format
 * @param {Object} wipp - WIPP plugin object
 * @returns {Object} LITE plugin object
 */
export function convertWippToLite(wipp) {
  // Extract plugin name and create ID
  // WIPP plugins typically have a name like "File Renaming"
  const pluginName = wipp.name || wipp.title || 'wipp-plugin';
  const pluginId = pluginName.toLowerCase().replace(/\s+/g, '-');
  
  // Try to extract owner from containerId (e.g., "polusai/file-renaming-tool:0.2.4")
  let owner = 'wipp';
  if (wipp.containerId) {
    const containerParts = wipp.containerId.split('/');
    if (containerParts.length > 0) {
      owner = containerParts[0];
    }
  }
  const fullPluginId = `${owner}-${pluginId}`;

  // Convert inputs
  const inputs = (wipp.inputs || []).map(input => {
    const inputId = input.name || 'input';
    const liteInput = {
      id: inputId,
      name: getInputName(input, wipp.ui),
      type: mapWippTypeToLite(input.type),
      description: input.description || '',
      required: input.required !== false // Default to true unless explicitly false
    };

    // Add default value if present
    if (input.default !== undefined) {
      liteInput.default = input.default;
    }

    // Map UI configuration from WIPP ui array
    const uiConfig = findUiConfig(wipp.ui, `inputs.${inputId}`);
    if (uiConfig) {
      liteInput.ui = mapUiConfig(uiConfig, input);
    }

    return liteInput;
  });

  // Convert outputs
  const outputs = (wipp.outputs || []).map(output => {
    return {
      id: output.name || 'output',
      name: output.name || 'Output',
      type: mapWippTypeToLite(output.type),
      description: output.description || ''
    };
  });

  // Build command from containerId and baseCommand
  const command = buildCommand(wipp.containerId, wipp.baseCommand, inputs, outputs);

  // Build LITE plugin object
  const litePlugin = {
    id: fullPluginId,
    name: wipp.title || wipp.name || 'WIPP Plugin',
    description: wipp.description || '',
    version: wipp.version || '1.0.0',
    inputs: inputs,
    outputs: outputs,
    command: command
  };

  return litePlugin;
}

/**
 * Map WIPP type to LITE type
 */
function mapWippTypeToLite(wippType) {
  const typeMap = {
    'collection': 'directory',
    'path': 'directory',
    'string': 'string',
    'number': 'number',
    'integer': 'number',
    'boolean': 'boolean',
    'enum': 'string' // Enums become strings with combo control
  };

  return typeMap[wippType?.toLowerCase()] || 'string';
}

/**
 * Get input display name from UI config or use input name
 */
function getInputName(input, uiArray) {
  const uiConfig = findUiConfig(uiArray, `inputs.${input.name}`);
  if (uiConfig?.title) {
    return uiConfig.title;
  }
  // Capitalize and format the input name
  return input.name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Find UI config for a given key
 */
function findUiConfig(uiArray, key) {
  if (!uiArray || !Array.isArray(uiArray)) {
    return null;
  }
  return uiArray.find(ui => ui.key === key);
}

/**
 * Map UI configuration from WIPP to LITE format
 */
function mapUiConfig(uiConfig, input) {
  const liteUi = {};

  // Handle enum types - convert to combo control
  if (input.type === 'enum' && input.options?.values) {
    liteUi.control = 'combo';
    liteUi.options = input.options.values;
    return liteUi;
  }

  // Map based on input type
  if (input.type === 'string') {
    liteUi.control = 'text';
    // Check if it might be multiline (long descriptions or pattern-related)
    if (input.description?.length > 100 || input.name?.toLowerCase().includes('pattern')) {
      liteUi.multiline = true;
    }
  } else if (input.type === 'number' || input.type === 'integer') {
    liteUi.control = 'number';
  } else if (input.type === 'boolean') {
    liteUi.control = 'toggle';
  } else if (input.type === 'collection' || input.type === 'path') {
    liteUi.control = 'text'; // Directory inputs use text control
  }

  return Object.keys(liteUi).length > 0 ? liteUi : undefined;
}

/**
 * Build Docker command from containerId and baseCommand
 * WIPP plugins use: baseCommand + input args + output path
 */
function buildCommand(containerId, baseCommand, inputs, outputs) {
  if (!containerId) {
    throw new Error('containerId is required for WIPP plugins');
  }

  // Build command args
  const args = [
    'run',
    '--rm',
    containerId
  ];

  // Add baseCommand parts (e.g., ["python3", "-m", "polus.images.formats.file_renaming"])
  if (baseCommand && Array.isArray(baseCommand)) {
    args.push(...baseCommand);
  }

  // Add input arguments in order
  // Directory/collection inputs are mounted as volumes, so we use the mount path
  // Other inputs are passed as command-line arguments
  inputs.forEach(input => {
    if (input.type === 'directory') {
      // Directory inputs: use mount path /input/{inputId}
      args.push(`/input/${input.id}`);
    } else {
      // Other inputs: use placeholder that will be replaced with actual value
      args.push(`{${input.id}}`);
    }
  });

  // Add output path (always /output for WIPP plugins)
  if (outputs.length > 0) {
    args.push('/output');
  }

  return {
    program: 'docker',
    args: args
  };
}
