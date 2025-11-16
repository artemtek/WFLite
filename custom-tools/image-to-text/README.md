# Artemtek Image to Text Plugin

An OCR (Optical Character Recognition) plugin that converts images to text files. Perfect for extracting text from screenshots, scanned documents, photos of text, and more.

## Description

The Image to Text plugin uses Tesseract OCR to extract text from images. It processes all supported image files in the input directory and creates corresponding text files in the output directory.

## Features

- **Batch Processing**: Processes all images in a directory at once
- **Image Preprocessing**: Automatically enhances images for better OCR accuracy
- **Multiple Formats**: Supports PNG, JPG, JPEG, TIFF, BMP, GIF, WEBP
- **Results Summary**: Generates a JSON report with processing results

## Inputs

- **Input Directory** (`inputDir`): The source directory containing images to convert
  - Type: `directory`
  - Required: Yes
  - Supported formats: PNG, JPG, JPEG, TIFF, BMP, GIF, WEBP

## Outputs

- **Output Directory** (`outputDir`): The destination directory where text files will be saved
  - Type: `directory`
  - Required: Yes
  - Output format: One `.txt` file per image (same filename, different extension)
  - Also includes `ocr_results.json` with processing summary

## Usage

When used in a workflow:
1. Connect a Folder Picker node or another node's output directory to the Input Directory input
2. The plugin will process all images in the directory
3. Text files will be saved to the output directory
4. The output directory can be connected to subsequent nodes in the workflow

## Docker Image

Build the Docker image:
```bash
cd custom-tools/image-to-text
docker build -t artemtek/image-to-text:latest .
```

## Technical Details

- **OCR Engine**: Tesseract OCR
- **Language**: English (can be extended)
- **Image Processing**: OpenCV for preprocessing (grayscale, thresholding, denoising)
- **Python Libraries**: pytesseract, Pillow, opencv-python

## Example Workflow

```
Folder Picker → Image to Text → [Next Node]
```

The Folder Picker selects a directory with screenshots, the Image to Text plugin extracts text from all images, and subsequent nodes can process the text files.

## Output Format

For each image file (e.g., `email_screenshot.png`), the plugin creates:
- `email_screenshot.txt` - Contains the extracted text

Additionally:
- `ocr_results.json` - Summary of processing with success/failure status for each file

