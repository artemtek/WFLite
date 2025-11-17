/**
 * Convert ICT (Image Container Tool) YAML format to LITE plugin format
 * @param {Object} ict - ICT plugin object (parsed YAML)
 * @returns {Object} LITE plugin object
 */
export function convertIctToLite(ict) {
  // Extract plugin name from ICT name (format: "owner/PluginName")
  const nameParts = ict.name?.split('/') || [];
  const owner = nameParts[0] || 'ict';
  const pluginName = nameParts[1] || ict.title || 'plugin';
  const pluginId = `${owner}-${pluginName.toLowerCase().replace(/\s+/g, '-')}`;

  // Convert inputs
  const inputs = (ict.inputs || []).map(input => {
    const inputId = input.name || 'input';
    const liteInput = {
      id: inputId,
      name: getInputName(input, ict.ui),
      type: mapIctTypeToLite(input.type, input.format),
      description: input.description || '',
      required: input.required !== false // In ICT, required defaults to true unless explicitly false
    };

    // Add default value if present
    if (input.default !== undefined) {
      liteInput.default = input.default;
    }

    // Map UI configuration from ICT ui array
    const uiConfig = findUiConfig(ict.ui, `inputs.${inputId}`);
    if (uiConfig) {
      liteInput.ui = mapUiConfig(uiConfig, input);
    }

    return liteInput;
  });

  // Convert outputs
  const outputs = (ict.outputs || []).map(output => {
    return {
      id: output.name || 'output',
      name: output.name || 'Output',
      type: mapIctTypeToLite(output.type, output.format),
      description: output.description || ''
    };
  });

  // Build command from container and entrypoint
  const command = buildCommand(ict.container, ict.entrypoint, inputs, outputs);

  // Build LITE plugin object
  const litePlugin = {
    id: pluginId,
    name: ict.title || ict.name || 'ICT Plugin',
    description: ict.description || '',
    version: ict.version || '1.0.0',
    inputs: inputs,
    outputs: outputs,
    command: command
  };

  return litePlugin;
}

/**
 * Map ICT type to LITE type
 */
function mapIctTypeToLite(ictType, format) {
  // Check format first (more specific)
  if (format && Array.isArray(format)) {
    if (format.includes('collection') || format.includes('stitchingVector')) {
      return 'directory';
    }
    if (format.includes('string')) {
      return 'string';
    }
    if (format.includes('integer') || format.includes('number')) {
      return 'number';
    }
    if (format.includes('array')) {
      return 'string'; // Arrays as comma-separated strings for now
    }
  }

  // Map by type
  const typeMap = {
    'path': 'directory',
    'collection': 'directory',
    'stitchingVector': 'directory',
    'string': 'string',
    'number': 'number',
    'integer': 'number',
    'array': 'string', // Arrays as comma-separated strings
    'boolean': 'boolean'
  };

  return typeMap[ictType?.toLowerCase()] || 'string';
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
 * Map UI configuration from ICT to LITE format
 */
function mapUiConfig(uiConfig, input) {
  const liteUi = {};

  // Map UI type to control
  const uiTypeMap = {
    'text': 'text',
    'number': 'number',
    'path': 'text', // Path inputs use text control
    'boolean': 'toggle'
  };

  const uiType = uiConfig.type?.toLowerCase();
  if (uiType) {
    liteUi.control = uiTypeMap[uiType] || 'text';
  }

  // Handle multiline text
  if (uiType === 'text' && input.type === 'string' && (input.description?.length > 100 || input.name?.includes('pattern'))) {
    liteUi.multiline = true;
  }

  // Handle combo/select (if options exist)
  if (input.options?.values && Array.isArray(input.options.values)) {
    liteUi.control = 'combo';
    liteUi.options = input.options.values;
  }

  return Object.keys(liteUi).length > 0 ? liteUi : undefined;
}

/**
 * Build Docker command from container and entrypoint
 * ICT plugins typically use: entrypoint + input args + output path
 */
function buildCommand(container, entrypoint, inputs, outputs) {
  if (!container) {
    throw new Error('Container is required for ICT plugins');
  }

  // Parse entrypoint (e.g., "python3 -m polus.images.transforms.images.montage")
  const entrypointParts = (entrypoint || '').split(' ').filter(p => p.length > 0);
  
  // Build command args
  const args = [
    'run',
    '--rm',
    container
  ];

  // Add entrypoint parts
  args.push(...entrypointParts);

  // Add input arguments in order
  // Directory inputs are mounted as volumes, so we use the mount path
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

  // Add output path (always /output for ICT plugins)
  if (outputs.length > 0) {
    args.push('/output');
  }

  return {
    program: 'docker',
    args: args
  };
}

