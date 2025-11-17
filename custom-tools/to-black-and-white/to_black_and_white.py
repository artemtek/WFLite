#!/usr/bin/env python3
"""
Image to Black and White Converter
Converts images in a directory to black and white (grayscale).
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageOps

# Supported image formats
SUPPORTED_FORMATS = {'.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif', '.webp'}


def convert_to_bw(image_path, output_path):
    """
    Convert a single image to black and white.
    """
    try:
        # Open image
        img = Image.open(image_path)
        
        # Convert to grayscale
        bw_img = ImageOps.grayscale(img)
        
        # Convert back to RGB mode for consistent output format
        bw_img = bw_img.convert('RGB')
        
        # Save the black and white image
        bw_img.save(output_path, quality=95)
        
        return True, None
    except Exception as e:
        return False, str(e)


def process_directory(input_dir, output_dir):
    """
    Process all images in the input directory and convert them to black and white.
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    # Create output directory if it doesn't exist
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Find all image files
    image_files = []
    for ext in SUPPORTED_FORMATS:
        image_files.extend(input_path.glob(f'*{ext}'))
        image_files.extend(input_path.glob(f'*{ext.upper()}'))
    
    if not image_files:
        print(f"Error: No supported image files found in {input_dir}")
        sys.exit(1)
    
    print(f"Found {len(image_files)} image file(s) to convert...")
    
    processed = 0
    failed = 0
    
    for image_file in image_files:
        print(f"Processing: {image_file.name}")
        
        # Determine output filename (preserve extension)
        output_file = output_path / image_file.name
        
        # Convert to black and white
        success, error = convert_to_bw(image_file, output_file)
        
        if success:
            print(f"  ✓ Converted to {output_file.name}")
            processed += 1
        else:
            print(f"  ✗ Error: {error}")
            failed += 1
    
    print(f"\nProcessed: {processed}, Failed: {failed}")
    
    if failed > 0:
        sys.exit(1)


def main():
    if len(sys.argv) < 3:
        print("Usage: to_black_and_white.py <input_dir> <output_dir>")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Validate input directory
    if not os.path.isdir(input_dir):
        print(f"Error: Input directory does not exist: {input_dir}")
        sys.exit(1)
    
    # Process directory
    process_directory(input_dir, output_dir)


if __name__ == '__main__':
    main()

