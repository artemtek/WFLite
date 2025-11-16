#!/bin/bash

# Copy plugin - copies all files from InputDir to OutputDir
# Usage: copy.sh <inputDir> <outputDir>

set -e  # Exit on error

INPUT_DIR="${1:-/input/inputDir}"
OUTPUT_DIR="${2:-/output}"

# Check if input directory exists
if [ ! -d "$INPUT_DIR" ]; then
    echo "Error: Input directory does not exist: $INPUT_DIR" >&2
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Copy all files and directories from input to output
echo "Copying files from $INPUT_DIR to $OUTPUT_DIR..."
cp -r "$INPUT_DIR"/* "$OUTPUT_DIR/" 2>/dev/null || {
    # If no files to copy, that's okay
    if [ -z "$(ls -A "$INPUT_DIR" 2>/dev/null)" ]; then
        echo "Input directory is empty, nothing to copy."
    else
        echo "Warning: Some files may not have been copied." >&2
        exit 1
    fi
}

echo "Copy completed successfully!"
echo "Files copied to: $OUTPUT_DIR"

