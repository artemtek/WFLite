#!/usr/bin/env python3
"""
Image Colorizer
Colorizes grayscale images in a directory.
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageOps

# Supported image formats
SUPPORTED_FORMATS = {'.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif', '.webp'}


def colorize_image(image_path, output_path):
    """
    Colorize a single grayscale image.
    """
    try:
        # Open image
        img = Image.open(image_path)
        
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Convert to grayscale first to ensure we're working with a grayscale image
        gray = ImageOps.grayscale(img)
        
        # Create a colorized version by applying a color tint
        # This is a simple colorization - for more advanced colorization,
        # you would typically use a neural network model
        colorized = Image.new('RGB', gray.size)
        
        # Apply a warm sepia-like colorization
        pixels = gray.load()
        color_pixels = colorized.load()
        
        for y in range(gray.height):
            for x in range(gray.width):
                gray_val = pixels[x, y]
                # Apply sepia tone
                r = min(255, int(gray_val * 1.2))
                g = min(255, int(gray_val * 1.0))
                b = min(255, int(gray_val * 0.8))
                color_pixels[x, y] = (r, g, b)
        
        # Save the colorized image
        colorized.save(output_path, quality=95)
        
        return True, None
    except Exception as e:
        return False, str(e)


def process_directory(input_dir, output_dir):
    """
    Process all images in the input directory and colorize them.
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
    
    print(f"Found {len(image_files)} image file(s) to colorize...")
    
    processed = 0
    failed = 0
    
    for image_file in image_files:
        print(f"Processing: {image_file.name}")
        
        # Determine output filename (preserve extension)
        output_file = output_path / image_file.name
        
        # Colorize image
        success, error = colorize_image(image_file, output_file)
        
        if success:
            print(f"  ✓ Colorized to {output_file.name}")
            processed += 1
        else:
            print(f"  ✗ Error: {error}")
            failed += 1
    
    print(f"\nProcessed: {processed}, Failed: {failed}")
    
    if failed > 0:
        sys.exit(1)


def main():
    if len(sys.argv) < 3:
        print("Usage: colorize.py <input_dir> <output_dir>")
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

