# Copy Plugin

A simple plugin that copies all files and directories from an input directory to an output directory.

## Description

The Copy plugin recursively copies all files and subdirectories from the specified input directory to the output directory. This is useful for testing workflows and as a building block for more complex operations.

## Inputs

- **Input Directory** (`inputDir`): The source directory containing files to copy
  - Type: `directory`
  - Required: Yes

## Outputs

- **Output Directory** (`outputDir`): The destination directory where files will be copied
  - Type: `directory`
  - Required: Yes

## Usage

When used in a workflow:
1. Connect a Folder Picker node or another node's output directory to the Input Directory input
2. The plugin will copy all files from the input to the output directory
3. The output directory can be connected to subsequent nodes in the workflow

## Docker Image

Build the Docker image:
```bash
cd custom-tools/copy
docker build -t lite/copy:latest .
```

## Script

The plugin uses a simple bash script (`copy.sh`) that:
- Takes input and output directories as arguments
- Creates the output directory if it doesn't exist
- Recursively copies all files and subdirectories
- Provides error handling and status messages

## Example Workflow

```
Folder Picker → Copy Plugin → [Next Node]
```

The Folder Picker selects a source directory, the Copy plugin copies it to its output directory, and subsequent nodes can process the copied files.

