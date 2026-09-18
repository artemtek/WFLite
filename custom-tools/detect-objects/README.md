# Detect Objects

Detects objects in images using YOLOv8n (nano), a lightweight AI model optimized for speed and size.

## Features

- Detects 80 common object classes (person, car, dog, cat, etc.)
- Lightweight model (~6MB) for fast processing
- Outputs both human-readable text and structured JSON
- Configurable confidence threshold
- Processes multiple images in batch

## Usage

1. Place images in the input directory
2. Set confidence threshold (0.0-1.0, default: 0.25)
3. Run the tool
4. Results are saved as:
   - `{image_name}_detections.txt` - Human-readable list of detected objects
   - `{image_name}_detections.json` - Structured JSON with bounding boxes and confidence scores
   - `detection_results.json` - Summary of all processed images

## Output Format

### Text Output Example
```
Detected 3 object(s):
  - person: 2
  - car: 1

Detailed detections:
1. person (confidence: 87.5%, bbox: [120, 50, 300, 450])
2. person (confidence: 92.3%, bbox: [400, 80, 550, 420])
3. car (confidence: 78.9%, bbox: [200, 300, 450, 380])
```

### JSON Output Example
```json
{
  "image": "/input/image.jpg",
  "total_objects": 3,
  "objects": [
    {
      "class": "person",
      "confidence": 0.923,
      "bbox": {
        "x1": 400.0,
        "y1": 80.0,
        "x2": 550.0,
        "y2": 420.0
      }
    }
  ]
}
```

## Building

```bash
cd custom-tools/detect-objects
docker build -t lite/detect-objects:latest .
```

## Model

Uses YOLOv8n (nano) from Ultralytics:
- Model size: ~6MB
- Speed: Fast inference
- Accuracy: Good for general object detection
- Classes: 80 COCO classes (person, vehicle, animal, furniture, etc.)

The model is pre-downloaded during Docker build and included in the image (~6MB), so no internet connection is needed at runtime.

