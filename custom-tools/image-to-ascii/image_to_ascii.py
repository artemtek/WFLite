#!/usr/bin/env python3
"""
Image to ASCII Art Converter
Converts images in a directory to ASCII art text files.
"""

import os
import sys
import argparse
from pathlib import Path
from PIL import Image
import json

# Supported image formats
SUPPORTED_FORMATS = {'.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif', '.webp'}

# ASCII characters from darkest to lightest
ASCII_CHARS = '@%#*+=-:. '


def resize_image(image, new_width=100):
    """
    Resize image maintaining aspect ratio.
    """
    width, height = image.size
    aspect_ratio = height / width
    new_height = int(new_width * aspect_ratio * 0.55)  # 0.55 to account for character aspect ratio
    return image.resize((new_width, new_height))


def image_to_ascii(image_path, width=100, chars=ASCII_CHARS):
    """
    Convert an image to ASCII art.
    
    Args:
        image_path: Path to the image file
        width: Width of ASCII art in characters
        chars: String of characters to use (darkest to lightest)
    
    Returns:
        ASCII art string or None if error
    """
    try:
        # Open and convert to grayscale
        img = Image.open(image_path)
        img = img.convert('L')  # Convert to grayscale
        
        # Resize image
        img = resize_image(img, width)
        
        # Get pixel data
        pixels = img.getdata()
        
        # Convert pixels to ASCII
        ascii_str = ''
        for i, pixel in enumerate(pixels):
            # Map pixel value (0-255) to ASCII character index
            char_index = int((pixel / 255) * (len(chars) - 1))
            ascii_str += chars[char_index]
            
            # Add newline at end of each row
            if (i + 1) % width == 0:
                ascii_str += '\n'
        
        return ascii_str, None
    except Exception as e:
        return None, str(e)


def process_directory(input_dir, output_dir, width=100, chars=ASCII_CHARS):
    """
    Process all images in the input directory and save ASCII art files to output directory.
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
        return {
            'success': False,
            'message': f'No supported image files found in {input_dir}',
            'processed': 0,
            'failed': 0
        }
    
    results = {
        'success': True,
        'processed': 0,
        'failed': 0,
        'files': []
    }
    
    print(f"Found {len(image_files)} image file(s) to process...")
    
    for image_file in image_files:
        print(f"Processing: {image_file.name}")
        
        # Convert to ASCII
        ascii_art, error = image_to_ascii(image_file, width, chars)
        
        if error:
            print(f"  Error: {error}")
            results['failed'] += 1
            results['files'].append({
                'file': image_file.name,
                'status': 'failed',
                'error': error
            })
            continue
        
        if ascii_art is None:
            print(f"  Error: Failed to convert image")
            results['failed'] += 1
            results['files'].append({
                'file': image_file.name,
                'status': 'failed',
                'error': 'Unknown error during conversion'
            })
            continue
        
        # Save ASCII art to output file
        output_file = output_path / f"{image_file.stem}.txt"
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(ascii_art)
            
            print(f"  ✓ Converted to ASCII art ({len(ascii_art)} characters), saved to {output_file.name}")
            results['processed'] += 1
            results['files'].append({
                'file': image_file.name,
                'status': 'success',
                'output': output_file.name,
                'ascii_length': len(ascii_art)
            })
        except Exception as e:
            print(f"  Error writing output: {e}")
            results['failed'] += 1
            results['files'].append({
                'file': image_file.name,
                'status': 'failed',
                'error': str(e)
            })
    
    return results


def main():
    parser = argparse.ArgumentParser(description='Convert images to ASCII art')
    parser.add_argument('input_dir', help='Input directory containing images')
    parser.add_argument('output_dir', help='Output directory for ASCII art text files')
    parser.add_argument('--width', type=int, default=100,
                       help='Width of ASCII art in characters (default: 100)')
    parser.add_argument('--chars', type=str, default=ASCII_CHARS,
                       help='ASCII characters to use, from darkest to lightest (default: @%%#*+=-:. )')
    
    args = parser.parse_args()
    
    # Validate input directory
    if not os.path.isdir(args.input_dir):
        print(f"Error: Input directory does not exist: {args.input_dir}")
        sys.exit(1)
    
    # Validate width
    if args.width < 10 or args.width > 500:
        print(f"Warning: Width {args.width} is outside recommended range (10-500). Using default 100.")
        args.width = 100
    
    # Process directory
    results = process_directory(args.input_dir, args.output_dir, args.width, args.chars)
    
    # Print summary
    print("\n" + "="*50)
    print("ASCII Art Conversion Summary")
    print("="*50)
    print(f"Total files processed: {results['processed']}")
    print(f"Failed: {results['failed']}")
    if (results['processed'] + results['failed']) > 0:
        success_rate = (results['processed'] / (results['processed'] + results['failed']) * 100)
        print(f"Success rate: {success_rate:.1f}%")
    
    if not results['success']:
        print(f"\nError: {results['message']}")
        sys.exit(1)
    
    # Save results JSON
    results_file = Path(args.output_dir) / 'ascii_results.json'
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to: {results_file}")
    print("="*50)


if __name__ == '__main__':
    main()

