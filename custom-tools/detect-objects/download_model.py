#!/usr/bin/env python3
"""Download YOLOv8n model during Docker build."""

# Fix for PyTorch 2.6+ weights_only restriction
import torch
_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs.setdefault('weights_only', False)
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load

# Download the model
from ultralytics import YOLO
print("Downloading YOLOv8n model...")
model = YOLO('yolov8n.pt')
print("Model downloaded successfully!")

