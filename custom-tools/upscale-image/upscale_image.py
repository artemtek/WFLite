#!/usr/bin/env python3
"""
Image Upscaler
Upscales images in a directory by a specified factor.
"""

import os
import sys
from pathlib import Path
from PIL import Image

# Supported image formats
SUPPORTED_FORMATS = {'.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif', '.webp'}


def upscale_image(image_path, output_path, scale_factor):
    """
    Upscale a single image by the specified factor.
    """
    try:
        # Open image
        img = Image.open(image_path)
        
        # Calculate new size
        new_width = int(img.width * scale_factor)
        new_height = int(img.height * scale_factor)
        
        # Resize using LANCZOS resampling for high quality
        upscaled_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Save the upscaled image
        upscaled_img.save(output_path, quality=95)
        
        return True, None
    except Exception as e:
        return False, str(e)


def process_directory(input_dir, output_dir, scale_factor):
    """
    Process all images in the input directory and upscale them.
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
    
    print(f"Found {len(image_files)} image file(s) to upscale...")
    print(f"Scale factor: {scale_factor}x")
    
    processed = 0
    failed = 0
    
    for image_file in image_files:
        print(f"Processing: {image_file.name}")
        
        # Determine output filename (preserve extension)
        output_file = output_path / image_file.name
        
        # Upscale image
        success, error = upscale_image(image_file, output_file, scale_factor)
        
        if success:
            print(f"  ✓ Upscaled to {output_file.name}")
            processed += 1
        else:
            print(f"  ✗ Error: {error}")
            failed += 1
    
    print(f"\nProcessed: {processed}, Failed: {failed}")
    
    if failed > 0:
        sys.exit(1)


def main():
    if len(sys.argv) < 4:
        print("Usage: upscale_image.py <input_dir> <output_dir> <scale_factor>")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    output_dir = sys.argv[2]
    
    try:
        scale_factor = float(sys.argv[3])
        if scale_factor <= 0:
            raise ValueError("Scale factor must be positive")
    except ValueError as e:
        print(f"Error: Invalid scale factor: {e}")
        sys.exit(1)
    
    # Validate input directory
    if not os.path.isdir(input_dir):
        print(f"Error: Input directory does not exist: {input_dir}")
        sys.exit(1)
    
    # Process directory
    process_directory(input_dir, output_dir, scale_factor)


if __name__ == '__main__':
    main()

