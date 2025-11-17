# Workflow Builder for dockerized workflows.
- each node can be a dockerized script or sometimes just a bash command

## Plugin Development Guide

### Plugin Structure

Each plugin should be organized in `custom-tools/{plugin-name}/` with the following structure:

```
custom-tools/
  └── {plugin-name}/
      ├── Dockerfile              # Docker image definition
      ├── {script}                # Main script (bash, Python, etc.)
      ├── requirements.txt        # Python dependencies (if using Python)
      ├── {plugin-name}.json     # Plugin definition (or plugin.json)
      └── README.md               # Documentation
```

The plugin JSON must also be copied to `plugins/{owner}-{plugin-name}.json` to register it.

### Plugin JSON Schema

```json
{
  "id": "owner-plugin-name",           // Unique identifier (use owner prefix)
  "name": "Display Name",              // Human-readable name
  "description": "Plugin description", // What the plugin does
  "version": "1.0.0",                  // Version string
  "inputs": [                          // Array of input definitions
    {
      "id": "inputId",                 // Unique input ID (used in placeholders)
      "name": "Input Name",            // Display name
      "type": "directory|text|number|boolean|string",  // Input type
      "description": "Input description",
      "required": true,                // Optional, defaults to false
      "default": "defaultValue",       // Optional default value
      "ui": {                          // Optional UI configuration
        "control": "text|number|toggle|combo|slider",
        "multiline": true,             // For text controls
        "options": ["opt1", "opt2"],   // For combo controls
        "visibleWhen": "expression"    // Conditional visibility
      }
    }
  ],
  "outputs": [                         // Array of output definitions
    {
      "id": "outputId",                // Unique output ID
      "name": "Output Name",           // Display name
      "type": "directory|file|string", // Output type
      "description": "Output description"
    }
  ],
  // Option 1: Specify full command (for custom command structure)
  "command": {
    "program": "docker",               // Usually "docker"
    "args": [                          // Command arguments
      "run",
      "--rm",
      "owner/image:tag",              // Docker image name
      "arg1",                          // Script arguments
      "{inputId}",                     // Placeholder for input
      "/output"                        // Output path (or {outputId})
    ]
  },
  // Option 2: Specify only Docker image (command auto-generated)
  "dockerImage": "owner/image:tag"     // Docker image - command will be auto-generated
}
```

**Note:** You can use either `command` or `dockerImage`. If `dockerImage` is specified, the command is automatically generated with:
- Input directories as `/input/{inputId}` arguments (in order)
- Output directory as `/output` argument
- Node property values as additional arguments (excluding internal properties starting with `_`)

### Input Types

- **`directory`**: Creates an input port that can receive directory paths from other nodes
- **`text`**: Text input with optional multiline support
- **`number`**: Numeric input
- **`boolean`**: Toggle/checkbox input
- **`string`**: String input (same as text)

### Output Types

- **`directory`**: Directory output that can be connected to other nodes
- **`file`**: File output
- **`string`**: String output

### Docker Volume Mounting

When the workflow executes, inputs and outputs are automatically mounted:

- **Inputs**: Mounted as `/input/{inputId}` (e.g., `/input/inputDir`)
- **Output**: Always mounted as `/output`

Example Docker command structure:
```json
"args": [
  "run",
  "--rm",
  "-v", "{inputPath}:/input/inputId",  // Auto-added by workflow executor
  "-v", "{outputPath}:/output",         // Auto-added by workflow executor
  "owner/image:tag",
  "/input/inputId",                     // Use in script
  "/output"                              // Use in script
]
```

### Placeholders

In command args, you can use placeholders:
- `{inputId}` - Replaced with container path `/input/{inputId}`
- `{outputId}` - Replaced with `/output`
- `{propertyKey}` - Replaced with node property value

### Dockerfile Best Practices

**For Bash scripts:**
```dockerfile
FROM alpine:latest
RUN apk add --no-cache bash [other-packages]
COPY script.sh /usr/local/bin/script.sh
RUN chmod +x /usr/local/bin/script.sh
ENTRYPOINT ["/usr/local/bin/script.sh"]
```

**For Python scripts:**
```dockerfile
FROM python:3.11-slim
# Install system dependencies (avoid deprecated packages)
RUN apt-get update && apt-get install -y \
    [packages] \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY script.py /usr/local/bin/script.py
RUN chmod +x /usr/local/bin/script.py
ENTRYPOINT ["python", "/usr/local/bin/script.py"]
```

**Common pitfalls:**
- Avoid `libgl1-mesa-glx` (deprecated) - use `libgl1` or remove if not needed
- Avoid `opencv-python` if possible - use Pillow for simpler image processing
- Always clean apt cache: `&& rm -rf /var/lib/apt/lists/*`

### Script Requirements

Scripts should:
1. Accept input directory as first argument: `/input/{inputId}`
2. Accept output directory as second argument: `/output`
3. Process all files in the input directory
4. Write results to the output directory
5. Exit with code 0 on success, non-zero on error
6. Print progress/status to stdout/stderr

### Example: Bash Plugin

**copy.sh:**
```bash
#!/bin/bash
INPUT_DIR="${1:-/input/inputDir}"
OUTPUT_DIR="${2:-/output}"
cp -r "$INPUT_DIR"/* "$OUTPUT_DIR/"
```

**copy.json:**
```json
{
  "id": "owner-copy",
  "name": "Copy",
  "inputs": [{"id": "inputDir", "name": "Input", "type": "directory"}],
  "outputs": [{"id": "outputDir", "name": "Output", "type": "directory"}],
  "command": {
    "program": "docker",
    "args": ["run", "--rm", "owner/copy:latest", "/input/inputDir", "/output"]
  }
}
```

### Example: Python Plugin

**image_to_text.py:**
```python
import sys
from pathlib import Path
# ... processing logic ...

if __name__ == '__main__':
    input_dir = sys.argv[1]  # /input/inputDir
    output_dir = sys.argv[2]  # /output
    process_directory(input_dir, output_dir)
```

### Plugin Registration

1. Create plugin in `custom-tools/{plugin-name}/`
2. Copy JSON to `plugins/{owner}-{plugin-name}.json`
3. Build Docker image: `docker build -t owner/image-name:latest .`
4. Plugin will appear in workflow builder automatically

### Naming Conventions

- **Plugin ID**: `{owner}-{plugin-name}` (e.g., `artemtek-copy`)
- **Docker Image**: `{owner}/{plugin-name}:latest` (e.g., `artemtek/copy:latest`)
- **Folder**: `{plugin-name}` (e.g., `copy`, `image-to-text`)
- **JSON File**: `{plugin-name}.json` or `plugin.json`

### Testing

1. Build Docker image locally
2. Test manually: `docker run --rm -v /path/to/input:/input/inputDir -v /path/to/output:/output owner/image:latest /input/inputDir /output`
3. Add to workflow and test execution
4. Check output in `~/lite-workflows/{execution-id}/node-{id}/`
