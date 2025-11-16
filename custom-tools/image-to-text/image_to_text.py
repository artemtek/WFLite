#!/usr/bin/env python3
"""
Image to Text Converter (OCR)
Converts images in a directory to text files using OCR.
"""

import os
import sys
import argparse
from pathlib import Path
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import json

# Supported image formats
SUPPORTED_FORMATS = {'.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif', '.webp'}


def preprocess_image(image_path):
    """
    Preprocess image to improve OCR accuracy using Pillow.
    """
    try:
        # Open image with PIL
        img = Image.open(image_path)
        
        # Convert to grayscale if not already
        if img.mode != 'L':
            img = img.convert('L')
        
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)
        
        # Enhance sharpness
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(2.0)
        
        # Apply slight smoothing to reduce noise
        img = img.filter(ImageFilter.MedianFilter(size=3))
        
        return img
    except Exception as e:
        print(f"Warning: Could not preprocess image {image_path}: {e}")
        return None


def extract_text_from_image(image_path, preprocess=True):
    """
    Extract text from a single image using OCR.
    """
    try:
        if preprocess:
            # Use preprocessed image
            pil_img = preprocess_image(image_path)
            if pil_img is None:
                # Fallback to original image if preprocessing fails
                pil_img = Image.open(image_path)
        else:
            # Use original image
            pil_img = Image.open(image_path)
        
        # Perform OCR
        text = pytesseract.image_to_string(pil_img, lang='eng')
        
        return text.strip(), None
    except Exception as e:
        return None, str(e)


def process_directory(input_dir, output_dir):
    """
    Process all images in the input directory and save text files to output directory.
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
        
        # Extract text
        text, error = extract_text_from_image(image_file)
        
        if error:
            print(f"  Error: {error}")
            results['failed'] += 1
            results['files'].append({
                'file': image_file.name,
                'status': 'failed',
                'error': error
            })
            continue
        
        # Save text to output file
        output_file = output_path / f"{image_file.stem}.txt"
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(text)
            
            print(f"  ✓ Extracted {len(text)} characters, saved to {output_file.name}")
            results['processed'] += 1
            results['files'].append({
                'file': image_file.name,
                'status': 'success',
                'output': output_file.name,
                'text_length': len(text)
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
    parser = argparse.ArgumentParser(description='Convert images to text using OCR')
    parser.add_argument('input_dir', help='Input directory containing images')
    parser.add_argument('output_dir', help='Output directory for text files')
    parser.add_argument('--no-preprocess', action='store_true', 
                       help='Skip image preprocessing (faster but less accurate)')
    
    args = parser.parse_args()
    
    # Validate input directory
    if not os.path.isdir(args.input_dir):
        print(f"Error: Input directory does not exist: {args.input_dir}")
        sys.exit(1)
    
    # Process directory
    results = process_directory(args.input_dir, args.output_dir)
    
    # Print summary
    print("\n" + "="*50)
    print("OCR Processing Summary")
    print("="*50)
    print(f"Total files processed: {results['processed']}")
    print(f"Failed: {results['failed']}")
    print(f"Success rate: {(results['processed']/(results['processed']+results['failed'])*100):.1f}%" if (results['processed']+results['failed']) > 0 else "N/A")
    
    if not results['success']:
        print(f"\nError: {results['message']}")
        sys.exit(1)
    
    # Save results JSON
    results_file = Path(args.output_dir) / 'ocr_results.json'
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to: {results_file}")
    print("="*50)


if __name__ == '__main__':
    main()

