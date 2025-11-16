FROM python:3.11-slim

# Install Tesseract OCR and dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the script
COPY image_to_text.py /usr/local/bin/image_to_text.py
RUN chmod +x /usr/local/bin/image_to_text.py

# Set the entrypoint
ENTRYPOINT ["python", "/usr/local/bin/image_to_text.py"]

