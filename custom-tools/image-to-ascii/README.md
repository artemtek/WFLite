# Image to ASCII Plugin

A plugin that converts images to ASCII art text files. Perfect for creating text-based representations of images, logos, or artwork.

## Description

The Image to ASCII plugin converts images to ASCII art by mapping pixel brightness values to ASCII characters. It processes all supported image files in the input directory and creates corresponding ASCII art text files in the output directory.

## Features

- **Batch Processing**: Processes all images in a directory at once
- **Customizable Width**: Adjustable ASCII art width (10-500 characters)
- **Multiple Formats**: Supports PNG, JPG, JPEG, TIFF, BMP, GIF, WEBP
- **Results Summary**: Generates a JSON report with processing results
- **Aspect Ratio Preservation**: Maintains image aspect ratio in ASCII output

## Inputs

- **Input Directory** (`inputDir`): The source directory containing images to convert
  - Type: `directory`
  - Required: Yes
  - Supported formats: PNG, JPG, JPEG, TIFF, BMP, GIF, WEBP

- **Width** (`width`): Width of ASCII art in characters
  - Type: `number`
  - Required: No
  - Default: 100
  - Range: 10-500
  - Controls the horizontal resolution of the ASCII art

## Outputs

- **Output Directory** (`outputDir`): The destination directory where ASCII art text files will be saved
  - Type: `directory`
  - Required: Yes
  - Output format: One `.txt` file per image (same filename, different extension)
  - Also includes `ascii_results.json` with processing summary

## Usage

When used in a workflow:
1. Connect a Folder Picker node or another node's output directory to the Input Directory input
2. Optionally adjust the Width parameter (default: 100 characters)
3. The plugin will process all images in the directory
4. ASCII art text files will be saved to the output directory
5. The output directory can be connected to subsequent nodes in the workflow

## Docker Image

Build the Docker image:
```bash
cd custom-tools/image-to-ascii
docker build -t lite/image-to-ascii:latest .
```

## Technical Details

- **Image Processing**: Pillow (PIL) for image loading and conversion
- **ASCII Characters**: Uses `@%#*+=-:. ` (darkest to lightest)
- **Python Libraries**: Pillow
- **Aspect Ratio**: Automatically adjusts height based on character aspect ratio

## Example Workflow

```
Folder Picker → Image to ASCII → [Next Node]
```

The Folder Picker selects a directory with images, the Image to ASCII plugin converts all images to ASCII art, and subsequent nodes can process the text files.

## Output Format

For each image file (e.g., `logo.png`), the plugin creates:
- `logo.txt` - Contains the ASCII art representation

Additionally:
- `ascii_results.json` - Summary of processing with success/failure status for each file

## ASCII Character Set

The default character set (`@%#*+=-:. `) provides good contrast:
- `@` - Darkest (black)
- `%` - Very dark
- `#` - Dark
- `*` - Medium-dark
- `+` - Medium
- `=` - Medium-light
- `-` - Light
- `:` - Very light
- `.` - Lightest
- ` ` (space) - White

