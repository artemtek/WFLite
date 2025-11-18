#!/usr/bin/env python3
"""
Object Detection Tool
Detects objects in images using YOLOv8n (nano) model and outputs detected objects as text.
"""

import os
import sys
import argparse
from pathlib import Path

# Fix for PyTorch 2.6+ weights_only restriction
# YOLO models need weights_only=False to load properly
# Monkey-patch torch.load before importing YOLO
import torch
_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs.setdefault('weights_only', False)
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load

from ultralytics import YOLO
from PIL import Image
import json

# Supported image formats
SUPPORTED_FORMATS = {'.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif', '.webp'}


def detect_objects_in_image(model, image_path, confidence_threshold=0.25):
    """
    Detect objects in a single image.
    
    Args:
        model: YOLO model instance
        image_path: Path to image file
        confidence_threshold: Minimum confidence for detections
    
    Returns:
        Tuple of (detections_list, detections_dict, error_message)
    """
    try:
        # Run inference
        results = model(str(image_path), conf=confidence_threshold, verbose=False)
        
        detections = []
        detections_dict = {
            'image': str(image_path),
            'total_objects': 0,
            'objects': []
        }
        
        # Process results
        for result in results:
            boxes = result.boxes
            
            for box in boxes:
                # Get class ID and name
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                confidence = float(box.conf[0])
                
                # Get bounding box coordinates
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                
                detections.append({
                    'class': class_name,
                    'confidence': round(confidence, 3),
                    'bbox': {
                        'x1': round(x1, 1),
                        'y1': round(y1, 1),
                        'x2': round(x2, 1),
                        'y2': round(y2, 1)
                    }
                })
        
        # Sort by confidence (highest first)
        detections.sort(key=lambda x: x['confidence'], reverse=True)
        detections_dict['objects'] = detections
        detections_dict['total_objects'] = len(detections)
        
        # Create human-readable text
        if detections:
            # Group by class and count
            class_counts = {}
            for det in detections:
                class_name = det['class']
                class_counts[class_name] = class_counts.get(class_name, 0) + 1
            
            # Create text output
            lines = [f"Detected {len(detections)} object(s):\n"]
            for class_name, count in sorted(class_counts.items()):
                lines.append(f"  - {class_name}: {count}")
            
            lines.append("\nDetailed detections:")
            for i, det in enumerate(detections, 1):
                lines.append(
                    f"{i}. {det['class']} "
                    f"(confidence: {det['confidence']:.1%}, "
                    f"bbox: [{det['bbox']['x1']:.0f}, {det['bbox']['y1']:.0f}, "
                    f"{det['bbox']['x2']:.0f}, {det['bbox']['y2']:.0f}])"
                )
            
            text_output = "\n".join(lines)
        else:
            text_output = "No objects detected."
        
        return text_output, detections_dict, None
        
    except Exception as e:
        return None, None, str(e)


def process_directory(input_dir, output_dir, confidence_threshold=0.25):
    """
    Process all images in the input directory and save detection results.
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
    
    # Load YOLO model (nano version for lightweight)
    print("Loading YOLOv8n model...")
    try:
        model = YOLO('yolov8n.pt')  # Nano model - lightweight
        print("Model loaded successfully!")
    except Exception as e:
        return {
            'success': False,
            'message': f'Failed to load model: {e}',
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
        
        # Detect objects
        text_output, detections_dict, error = detect_objects_in_image(
            model, image_file, confidence_threshold
        )
        
        if error:
            print(f"  Error: {error}")
            results['failed'] += 1
            results['files'].append({
                'file': image_file.name,
                'status': 'failed',
                'error': error
            })
            continue
        
        # Save text output (same name as source image, with .txt extension)
        output_file = output_path / f"{image_file.stem}.txt"
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(text_output)
            
            # Save JSON output
            json_file = output_path / f"{image_file.stem}_detections.json"
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(detections_dict, f, indent=2)
            
            total_objects = detections_dict['total_objects']
            print(f"  ✓ Detected {total_objects} object(s), saved to {output_file.name}")
            results['processed'] += 1
            results['files'].append({
                'file': image_file.name,
                'status': 'success',
                'output': output_file.name,
                'json_output': json_file.name,
                'objects_detected': total_objects
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
    parser = argparse.ArgumentParser(description='Detect objects in images using YOLOv8n')
    parser.add_argument('input_dir', help='Input directory containing images')
    parser.add_argument('output_dir', help='Output directory for detection results')
    parser.add_argument('--confidence', type=float, default=0.25,
                       help='Confidence threshold (0.0-1.0, default: 0.25)')
    
    args = parser.parse_args()
    
    # Validate input directory
    if not os.path.isdir(args.input_dir):
        print(f"Error: Input directory does not exist: {args.input_dir}")
        sys.exit(1)
    
    # Validate confidence threshold
    if not 0.0 <= args.confidence <= 1.0:
        print(f"Error: Confidence threshold must be between 0.0 and 1.0")
        sys.exit(1)
    
    # Process directory
    results = process_directory(args.input_dir, args.output_dir, args.confidence)
    
    # Print summary
    print("\n" + "="*50)
    print("Object Detection Summary")
    print("="*50)
    print(f"Total files processed: {results['processed']}")
    print(f"Failed: {results['failed']}")
    if results['processed'] + results['failed'] > 0:
        success_rate = (results['processed']/(results['processed']+results['failed'])*100)
        print(f"Success rate: {success_rate:.1f}%")
    
    if not results['success']:
        print(f"\nError: {results['message']}")
        sys.exit(1)
    
    # Save results JSON
    results_file = Path(args.output_dir) / 'detection_results.json'
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to: {results_file}")
    print("="*50)


if __name__ == '__main__':
    main()

