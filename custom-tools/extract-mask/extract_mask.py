#!/usr/bin/env python3
"""
Image Mask Extractor
Extracts masks from images (alpha channel or creates mask from transparency/color).
"""

import os
import sys
from pathlib import Path
from PIL import Image
import numpy as np

# Supported image formats
SUPPORTED_FORMATS = {'.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif', '.webp'}


def extract_mask(image_path, output_path):
    """
    Extract mask from a single image.
    Uses alpha channel if available, otherwise creates a mask based on transparency.
    """
    try:
        # Open image
        img = Image.open(image_path)
        
        # Check if image has alpha channel
        if img.mode in ('RGBA', 'LA') or 'transparency' in img.info:
            # Extract alpha channel as mask
            if img.mode == 'RGBA':
                # Extract alpha channel
                mask = img.split()[3]  # Alpha channel is the 4th channel
            elif img.mode == 'LA':
                # Extract alpha channel from LA mode
                mask = img.split()[1]
            else:
                # Convert to RGBA to get alpha
                img_rgba = img.convert('RGBA')
                mask = img_rgba.split()[3]
        else:
            # No alpha channel - create a mask from the image
            # Convert to grayscale and use threshold to create binary mask
            gray = img.convert('L')
            
            # Use Otsu's method threshold or simple threshold
            # For simplicity, use a threshold based on mean
            threshold = np.mean(np.array(gray))
            
            # Create binary mask (white for foreground, black for background)
            mask_array = np.array(gray)
            mask_array = (mask_array > threshold).astype(np.uint8) * 255
            mask = Image.fromarray(mask_array, mode='L')
        
        # Convert mask to RGB for consistent output
        mask_rgb = mask.convert('RGB')
        
        # Save the mask
        mask_rgb.save(output_path, quality=95)
        
        return True, None
    except Exception as e:
        return False, str(e)


def process_directory(input_dir, output_dir):
    """
    Process all images in the input directory and extract masks.
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
    
    print(f"Found {len(image_files)} image file(s) to process...")
    
    processed = 0
    failed = 0
    
    for image_file in image_files:
        print(f"Processing: {image_file.name}")
        
        # Determine output filename (preserve extension)
        output_file = output_path / image_file.name
        
        # Extract mask
        success, error = extract_mask(image_file, output_file)
        
        if success:
            print(f"  ✓ Extracted mask to {output_file.name}")
            processed += 1
        else:
            print(f"  ✗ Error: {error}")
            failed += 1
    
    print(f"\nProcessed: {processed}, Failed: {failed}")
    
    if failed > 0:
        sys.exit(1)


def main():
    if len(sys.argv) < 3:
        print("Usage: extract_mask.py <input_dir> <output_dir>")
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

