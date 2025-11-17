FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the script
COPY upscale_image.py /usr/local/bin/upscale_image.py
RUN chmod +x /usr/local/bin/upscale_image.py

# Set the entrypoint
ENTRYPOINT ["python", "/usr/local/bin/upscale_image.py"]

