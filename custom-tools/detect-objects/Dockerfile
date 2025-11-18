FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Set environment variable to fix PyTorch 2.6+ weights_only restriction
ENV TORCH_WEIGHTS_ONLY=False

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download YOLOv8n model to include in image
COPY download_model.py /tmp/download_model.py
RUN python /tmp/download_model.py && rm /tmp/download_model.py

# Copy the script
COPY detect_objects.py /usr/local/bin/detect_objects.py
RUN chmod +x /usr/local/bin/detect_objects.py

# Set the entrypoint
ENTRYPOINT ["python", "/usr/local/bin/detect_objects.py"]

